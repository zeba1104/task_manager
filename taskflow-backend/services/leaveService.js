const crypto = require('crypto');
const User = require('../models/User');
const LeaveRequest = require('../models/LeaveRequest');
const LeaveApprovalToken = require('../models/LeaveApprovalToken');
const Attendance = require('../models/Attendance');
const logActivity = require('../activityLogger');

/**
 * Calculates inclusive calendar days between two dates.
 */
const calculateTotalDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffTime = end.getTime() - start.getTime();
  if (diffTime < 0) return 0;
  return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

/**
 * Validates the reporting manager availability for an employee leave request.
 *
 * Conditions:
 * 1. Manager must exist and be assigned.
 * 2. Manager must be active, not suspended, and have a valid email.
 * 3. Overlapping date condition with APPROVED manager leave:
 *    managerLeave.startDate <= employeeLeave.endDate AND managerLeave.endDate >= employeeLeave.startDate
 *    (Only approved manager leave triggers automatic redirection!)
 */
const validateManagerAvailability = async (employeeId, startDate, endDate) => {
  const employee = await User.findById(employeeId).populate('manager').lean();
  if (!employee) {
    throw new Error('Employee not found');
  }

  // 1. Manager assigned?
  if (!employee.manager) {
    return {
      available: false,
      route: 'ADMIN',
      manager: null,
      reason: 'Employee has no assigned reporting manager. Automatically routed to Admin for approval.',
    };
  }

  const manager = employee.manager;

  // 2. Manager account validation
  if (!manager.isActive || manager.isSuspended || !manager.email) {
    return {
      available: false,
      route: 'ADMIN',
      manager,
      reason: 'Assigned reporting manager is inactive or unavailable. Automatically routed to Admin for approval.',
    };
  }

  // 3. Overlapping date validation with manager's APPROVED leaves
  const empStart = new Date(startDate);
  const empEnd = new Date(endDate);
  empStart.setHours(0, 0, 0, 0);
  empEnd.setHours(23, 59, 59, 999);

  // managerLeave.startDate <= employeeLeave.endDate AND managerLeave.endDate >= employeeLeave.startDate
  const overlappingApprovedLeave = await LeaveRequest.findOne({
    user: manager._id,
    status: 'approved', // CRUCIAL: Only APPROVED manager leave triggers redirection!
    startDate: { $lte: empEnd },
    endDate: { $gte: empStart },
  }).lean();

  if (overlappingApprovedLeave) {
    return {
      available: false,
      route: 'ADMIN',
      manager,
      reason: 'The assigned reporting manager is currently on approved leave during the requested period. This request has been automatically forwarded to Admin for approval.',
      overlappingLeave: overlappingApprovedLeave,
    };
  }

  return {
    available: true,
    route: 'MANAGER',
    manager,
    reason: 'Routed to assigned reporting manager.',
  };
};

/**
 * Identifies the primary active Admin approver.
 */
const getAuthorizedAdmin = async () => {
  let admin = await User.findOne({ role: 'Admin', isActive: true, isSuspended: false }).sort({ createdAt: 1 }).lean();
  if (!admin) {
    admin = await User.findOne({ role: 'Admin' }).lean();
  }
  if (!admin) {
    throw new Error('No authorized Admin found in the system to approve this leave request.');
  }
  return admin;
};

/**
 * Generates single-use cryptographically secure approval and rejection tokens.
 */
const createLeaveTokens = async (leaveRequestId, approverId, approverRole, baseUrl) => {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days expiry

  const approveTokenStr = crypto.randomBytes(32).toString('hex');
  const rejectTokenStr = crypto.randomBytes(32).toString('hex');

  const [approveToken, rejectToken] = await Promise.all([
    LeaveApprovalToken.create({
      leaveRequest: leaveRequestId,
      token: approveTokenStr,
      action: 'approve',
      approver: approverId,
      approverRole,
      expiresAt,
    }),
    LeaveApprovalToken.create({
      leaveRequest: leaveRequestId,
      token: rejectTokenStr,
      action: 'reject',
      approver: approverId,
      approverRole,
      expiresAt,
    }),
  ]);

  const cleanBase = (baseUrl || process.env.APP_URL || 'http://localhost:5000').replace(/\/$/, '');
  const approveUrl = `${cleanBase}/api/leave/action?token=${approveTokenStr}`;
  const rejectUrl = `${cleanBase}/api/leave/action?token=${rejectTokenStr}`;

  return {
    approveToken: approveTokenStr,
    rejectToken: rejectTokenStr,
    approveUrl,
    rejectUrl,
    expiresAt,
  };
};

/**
 * Deducts approved leave days from user's leave balance.
 */
const deductLeaveBalance = async (userId, leaveType, days) => {
  const user = await User.findById(userId);
  if (!user) return;

  if (!user.leaveBalance) {
    user.leaveBalance = { annual: 12, sick: 6, casual: 4, personal: 4, other: 4, maternity_paternity: 'As applicable' };
  }

  const typeKey = (leaveType || 'annual').toLowerCase();
  if (typeKey === 'maternity_paternity' || typeKey === 'parental' || typeKey.includes('maternity')) {
    // Policy / Legal leave - statutory leave, does not deduct from numeric annual/sick/casual balances
    return;
  }

  const key = (typeKey === 'personal' || typeKey === 'other') ? 'casual' : typeKey;
  const defaultAlloc = key === 'annual' ? 12 : key === 'sick' ? 6 : 4;
  const current = user.leaveBalance[key] ?? defaultAlloc;
  user.leaveBalance[key] = Math.max(0, current - days);
  if (key === 'casual') {
    user.leaveBalance.personal = user.leaveBalance[key];
    user.leaveBalance.other = user.leaveBalance[key];
  }
  user.markModified('leaveBalance');
  await user.save();
};

/**
 * Records attendance for approved leave dates.
 */
const markAttendanceOnLeave = async (userId, startDate, endDate, reason) => {
  try {
    const cur = new Date(startDate);
    const end = new Date(endDate);
    cur.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const datesToMark = [];
    while (cur <= end) {
      const year = cur.getFullYear();
      const month = String(cur.getMonth() + 1).padStart(2, '0');
      const day = String(cur.getDate()).padStart(2, '0');
      datesToMark.push(`${year}-${month}-${day}`);
      cur.setDate(cur.getDate() + 1);
    }

    await Promise.all(
      datesToMark.map((dateKey) =>
        Attendance.findOneAndUpdate(
          { user: userId, date: dateKey },
          {
            $set: {
              status: 'on-leave',
            },
            $setOnInsert: {
              user: userId,
              date: dateKey,
              clockIn: null,
              clockOut: null,
              totalSeconds: 0,
            },
          },
          { upsert: true, new: true }
        )
      )
    );
  } catch (err) {
    console.error('Failed to mark attendance on leave:', err.message);
  }
};

/**
 * Processes an approval or rejection decision.
 */
const processLeaveDecision = async ({
  tokenString,
  action, // 'approve' | 'reject'
  rejectionReason = '',
  approverOverrideUser = null,
  isManualOverride = false,
  leaveRequestId = null,
}) => {
  let tokenDoc = null;
  let targetLeaveId = leaveRequestId;
  let approver = approverOverrideUser;
  let approverRole = approverOverrideUser?.role || 'Admin';

  if (!isManualOverride) {
    if (!tokenString) {
      return { success: false, code: 'TOKEN_MISSING', message: 'Approval token is required.' };
    }

    tokenDoc = await LeaveApprovalToken.findOne({ token: tokenString }).populate('approver');
    if (!tokenDoc) {
      return { success: false, code: 'TOKEN_INVALID', message: 'This approval link is invalid or has expired.' };
    }

    targetLeaveId = tokenDoc.leaveRequest;
    approver = tokenDoc.approver;
    approverRole = tokenDoc.approverRole;

    if (tokenDoc.isUsed) {
      return {
        success: false,
        code: 'TOKEN_ALREADY_USED',
        message: `This action link was already processed on ${new Date(tokenDoc.usedAt).toLocaleString()}. No further action is required.`,
      };
    }

    if (new Date() > tokenDoc.expiresAt) {
      return {
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'This approval link has expired. The leave request is pending an authorized decision.',
      };
    }
  }

  const leaveRequest = await LeaveRequest.findById(targetLeaveId).populate('user').populate('assignedManager');
  if (!leaveRequest) {
    return { success: false, code: 'NOT_FOUND', message: 'Leave request not found.' };
  }

  if (leaveRequest.status === 'cancelled') {
    return {
      success: false,
      code: 'REQUEST_CANCELLED',
      message: 'This leave request was cancelled by the requester. No approval actions can be performed.',
    };
  }

  if (leaveRequest.status !== 'pending') {
    return {
      success: false,
      code: 'ALREADY_DECIDED',
      message: `This leave request has already been ${leaveRequest.status}.`,
    };
  }

  // =========================================================================
  // SECURITY VALIDATIONS:
  // 1. Prevention of Self-Approval
  // 2. Role Verification (Manager cannot approve Manager leave)
  // 3. Manager on leave verification at execution time
  // =========================================================================
  if (String(leaveRequest.user?._id) === String(approver?._id)) {
    return {
      success: false,
      code: 'SELF_APPROVAL_FORBIDDEN',
      message: 'Self-approval is strictly prohibited. You cannot approve your own leave request.',
    };
  }

  if (leaveRequest.requesterRole === 'Manager' && approverRole !== 'Admin') {
    return {
      success: false,
      code: 'MANAGER_REQUIRES_ADMIN',
      message: 'Manager leave requests can only be reviewed and approved by an authorized Admin.',
    };
  }

  if (approverRole === 'Manager') {
    // Verify manager is not currently on approved overlapping leave
    const mgrOnLeave = await LeaveRequest.findOne({
      user: approver._id,
      status: 'approved',
      startDate: { $lte: leaveRequest.endDate },
      endDate: { $gte: leaveRequest.startDate },
    }).lean();

    if (mgrOnLeave) {
      return {
        success: false,
        code: 'MANAGER_CURRENTLY_ON_LEAVE',
        message: 'You are currently on approved leave during this period and cannot process this request.',
      };
    }
  }

  // =========================================================================
  // EXECUTE DECISION
  // =========================================================================
  const isApproved = action === 'approve';
  const newStatus = isApproved ? 'approved' : 'rejected';
  const now = new Date();

  // Mark all tokens for this request as used
  if (tokenDoc) {
    tokenDoc.isUsed = true;
    tokenDoc.usedAt = now;
    await tokenDoc.save();
  }
  await LeaveApprovalToken.updateMany(
    { leaveRequest: leaveRequest._id, isUsed: false },
    { $set: { isUsed: true, usedAt: now } }
  );

  leaveRequest.status = newStatus;
  leaveRequest.approver = approver._id;
  leaveRequest.approverRole = approverRole;
  leaveRequest.reviewedBy = approver._id;
  leaveRequest.reviewedAt = now;

  if (isApproved) {
    leaveRequest.approvedAt = now;
    await deductLeaveBalance(leaveRequest.user._id, leaveRequest.leaveType, leaveRequest.totalDays);
    await markAttendanceOnLeave(
      leaveRequest.user._id,
      leaveRequest.startDate,
      leaveRequest.endDate,
      leaveRequest.reason
    );
  } else {
    leaveRequest.rejectedAt = now;
    leaveRequest.rejectionReason = rejectionReason || 'Request rejected by approver.';
  }

  const historyAction = isManualOverride ? 'OVERRIDDEN' : (isApproved ? 'APPROVED' : 'REJECTED');
  const historyNote = isManualOverride
    ? `Admin manual override: ${newStatus.toUpperCase()}${rejectionReason ? ` - ${rejectionReason}` : ''}`
    : (isApproved ? 'Approved via secure email action link.' : `Rejected via secure email action link. Reason: ${rejectionReason || 'No reason provided.'}`);

  leaveRequest.approvalHistory.push({
    action: historyAction,
    actor: approver._id,
    actorRole: approverRole,
    actorName: approver.name,
    timestamp: now,
    note: historyNote,
  });

  await leaveRequest.save();

  // Audit Log
  logActivity(
    approver._id,
    isManualOverride ? `manually overridden leave (${newStatus})` : `${newStatus} leave request`,
    'LeaveRequest',
    leaveRequest.user?.name || 'User',
    `Leave Type: ${leaveRequest.leaveType}, Days: ${leaveRequest.totalDays}, Approver Role: ${approverRole}`
  );

  return {
    success: true,
    leaveRequest,
    action: newStatus,
    approverName: approver.name,
    approverRole,
    rejectionReason: leaveRequest.rejectionReason,
  };
};

/**
 * Cancels a pending leave request and invalidates all associated tokens.
 */
const cancelLeaveRequest = async (leaveRequestId, userId) => {
  const leave = await LeaveRequest.findOne({ _id: leaveRequestId, user: userId });
  if (!leave) {
    throw new Error('Leave request not found or unauthorized.');
  }

  if (leave.status !== 'pending') {
    throw new Error(`Cannot cancel a leave request that is already ${leave.status}.`);
  }

  const now = new Date();
  leave.status = 'cancelled';
  leave.cancelledAt = now;
  leave.approvalHistory.push({
    action: 'CANCELLED',
    actor: userId,
    actorRole: leave.requesterRole,
    actorName: 'Requester',
    timestamp: now,
    note: 'Leave request cancelled by requester.',
  });
  await leave.save();

  // Invalidate all tokens
  await LeaveApprovalToken.updateMany(
    { leaveRequest: leave._id },
    { $set: { isUsed: true, usedAt: now } }
  );

  logActivity(userId, 'cancelled leave request', 'LeaveRequest', 'Leave Request', `Cancelled ${leave.leaveType} leave`);

  return leave;
};

module.exports = {
  calculateTotalDays,
  validateManagerAvailability,
  getAuthorizedAdmin,
  createLeaveTokens,
  deductLeaveBalance,
  markAttendanceOnLeave,
  processLeaveDecision,
  cancelLeaveRequest,
};
