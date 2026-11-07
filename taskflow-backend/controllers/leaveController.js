const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const leaveService = require('../services/leaveService');
const { sendLeaveApprovalEmail } = require('../config/email');
const logActivity = require('../activityLogger');

/**
 * POST /api/leave/apply
 * Applies for a new leave request (Employee or Manager).
 * Routes hierarchically to assigned Manager or fallback Admin.
 */
exports.applyLeave = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole; // 'Employee' | 'Manager' | 'Admin'

    const { leaveType = 'annual', startDate, endDate, reason = '' } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Start date and end date are required.' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid start or end date format.' });
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (end < start) {
      return res.status(400).json({ message: 'End date cannot be earlier than start date.' });
    }

    const totalDays = leaveService.calculateTotalDays(start, end);
    if (totalDays <= 0) {
      return res.status(400).json({ message: 'Leave duration must be at least 1 day.' });
    }

    // Check for existing overlapping active leave for this requester
    const overlappingSelfLeave = await LeaveRequest.findOne({
      user: userId,
      status: { $in: ['pending', 'approved'] },
      startDate: { $lte: end },
      endDate: { $gte: start },
    });

    if (overlappingSelfLeave) {
      return res.status(400).json({
        message: `You already have an existing ${overlappingSelfLeave.status} leave request overlapping this period (${new Date(overlappingSelfLeave.startDate).toLocaleDateString()} - ${new Date(overlappingSelfLeave.endDate).toLocaleDateString()}).`,
      });
    }

    const requester = await User.findById(userId).populate('manager');
    if (!requester) {
      return res.status(404).json({ message: 'Requester user profile not found.' });
    }

    // Supporting document if uploaded via multer
    let supportingDocData = { originalName: '', filename: '', path: '', size: 0 };
    if (req.file) {
      supportingDocData = {
        originalName: req.file.originalname,
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size,
        mimetype: req.file.mimetype,
      };
    }

    let assignedManagerId = null;
    let designatedApprover = null;
    let designatedApproverRole = 'Admin';
    let approvalRoute = 'ADMIN';
    let routingReason = '';
    let fallbackNotice = '';

    // =========================================================================
    // HIERARCHICAL ROUTING RULES
    // =========================================================================
    if (userRole === 'Manager') {
      // 1. MANAGER LEAVE REQUEST -> MUST GO TO ADMIN
      designatedApprover = await leaveService.getAuthorizedAdmin();
      designatedApproverRole = 'Admin';
      approvalRoute = 'ADMIN';
      routingReason = 'Manager leave request routed to Admin for hierarchical approval.';
    } else {
      // 2. EMPLOYEE LEAVE REQUEST -> EVALUATE ASSIGNED MANAGER AVAILABILITY
      const availability = await leaveService.validateManagerAvailability(userId, start, end);
      assignedManagerId = requester.manager?._id || null;

      if (availability.available) {
        // CASE A: Assigned Manager is available
        designatedApprover = availability.manager;
        designatedApproverRole = 'Manager';
        approvalRoute = 'MANAGER';
        routingReason = availability.reason;
      } else {
        // CASE B: Assigned Manager is on approved overlapping leave, inactive, or unassigned
        designatedApprover = await leaveService.getAuthorizedAdmin();
        designatedApproverRole = 'Admin';
        approvalRoute = 'ADMIN';
        routingReason = availability.reason;
        fallbackNotice = availability.reason;
      }
    }

    // Create the Leave Request record
    const leaveRequest = await LeaveRequest.create({
      user: userId,
      requesterRole: userRole,
      leaveType: (leaveType || 'annual').toLowerCase(),
      startDate: start,
      endDate: end,
      totalDays,
      reason: reason.trim(),
      supportingDocument: supportingDocData,
      assignedManager: assignedManagerId,
      approver: designatedApprover._id,
      approverRole: designatedApproverRole,
      approvalRoute,
      routingReason,
      status: 'pending',
      submittedAt: new Date(),
      approvalHistory: [
        {
          action: 'SUBMITTED',
          actor: userId,
          actorRole: userRole,
          actorName: requester.name,
          timestamp: new Date(),
          note: `Submitted ${leaveType} leave for ${totalDays} day(s).`,
        },
        {
          action: 'ROUTED',
          actor: null,
          actorRole: 'System',
          actorName: 'Workflow Engine',
          timestamp: new Date(),
          note: `Routed to ${designatedApproverRole} (${designatedApprover.name}). ${routingReason}`,
        },
      ],
    });

    // Create single-use tokens for the designated approver
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const tokenInfo = await leaveService.createLeaveTokens(
      leaveRequest._id,
      designatedApprover._id,
      designatedApproverRole,
      baseUrl
    );

    // Send email to designated approver (ONLY ONE APPROVER RECEIVES ACTIONABLE EMAIL!)
    try {
      if (designatedApprover.email) {
        await sendLeaveApprovalEmail({
          leaveRequest,
          requester,
          approver: designatedApprover,
          approveUrl: tokenInfo.approveUrl,
          rejectUrl: tokenInfo.rejectUrl,
          fallbackNotice,
        });
      }
    } catch (mailErr) {
      console.error('Failed to send leave approval email:', mailErr.message);
      // We don't fail the request creation, but log it
    }

    logActivity(
      userId,
      'applied for leave',
      'LeaveRequest',
      requester.name,
      `${leaveType} leave from ${start.toLocaleDateString()} to ${end.toLocaleDateString()} (${totalDays} days). Routed to ${designatedApproverRole}.`
    );

    const populated = await LeaveRequest.findById(leaveRequest._id)
      .populate('user', 'name email department designation employeeId role leaveBalance')
      .populate('assignedManager', 'name email designation')
      .populate('approver', 'name email designation role');

    return res.status(201).json({
      message: 'Leave request submitted successfully.',
      leaveRequest: populated,
      approvalRoute,
      routingReason,
      designatedApprover: {
        name: designatedApprover.name,
        role: designatedApproverRole,
      },
    });
  } catch (error) {
    console.error('Error applying for leave:', error);
    return res.status(500).json({ message: error.message || 'Could not process leave request.' });
  }
};

/**
 * GET /api/leave/mine
 * Retrieves the current logged-in user's leave history and balance.
 */
exports.getMyLeaves = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).select('name email role leaveBalance manager').populate('manager', 'name email designation');

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const leaveHistory = await LeaveRequest.find({ user: userId })
      .populate('assignedManager', 'name email designation')
      .populate('approver', 'name email designation role')
      .sort({ createdAt: -1 })
      .lean();

    const balance = {
      annual: user.leaveBalance?.annual ?? 12,
      sick: user.leaveBalance?.sick ?? 6,
      casual: user.leaveBalance?.casual ?? user.leaveBalance?.personal ?? 4,
      maternity_paternity: 'As applicable',
      personal: user.leaveBalance?.personal ?? 4,
      other: user.leaveBalance?.other ?? 4,
    };

    return res.json({
      leaveBalance: balance,
      assignedManager: user.manager,
      leaveRequests: leaveHistory,
      stats: {
        total: leaveHistory.length,
        pending: leaveHistory.filter((l) => l.status === 'pending').length,
        approved: leaveHistory.filter((l) => l.status === 'approved').length,
        rejected: leaveHistory.filter((l) => l.status === 'rejected').length,
        cancelled: leaveHistory.filter((l) => l.status === 'cancelled').length,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Could not fetch leave history.' });
  }
};

/**
 * POST /api/leave/:id/cancel
 * Cancels a pending leave request (invalidates tokens).
 */
exports.cancelLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await leaveService.cancelLeaveRequest(id, req.userId);
    return res.json({ message: 'Leave request cancelled successfully.', leaveRequest: updated });
  } catch (error) {
    return res.status(400).json({ message: error.message || 'Could not cancel leave request.' });
  }
};

/**
 * GET /api/admin/leave/all
 * Admin view of all employee and manager leave requests with hierarchical filters.
 */
exports.getAllLeavesForAdmin = async (req, res) => {
  try {
    if (req.userRole !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }

    const { filter = 'all', role = 'all', search = '' } = req.query;

    const query = {};

    if (filter === 'pending_admin') {
      query.status = 'pending';
      query.approvalRoute = 'ADMIN';
    } else if (filter === 'pending_manager') {
      query.status = 'pending';
      query.approvalRoute = 'MANAGER';
    } else if (filter === 'forwarded_admin') {
      query.approvalRoute = 'ADMIN';
      query.requesterRole = 'Employee'; // Employees whose manager was unavailable
    } else if (['pending', 'approved', 'rejected', 'cancelled'].includes(filter)) {
      query.status = filter;
    }

    if (role === 'Manager') {
      query.requesterRole = 'Manager';
    } else if (role === 'Employee') {
      query.requesterRole = 'Employee';
    }

    const leaves = await LeaveRequest.find(query)
      .populate('user', 'name email department designation employeeId role')
      .populate('assignedManager', 'name email designation')
      .populate('approver', 'name email designation role')
      .sort({ createdAt: -1 })
      .lean();

    let filtered = leaves;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = leaves.filter(
        (l) =>
          l.user?.name?.toLowerCase().includes(q) ||
          l.user?.department?.toLowerCase().includes(q) ||
          l.user?.employeeId?.toLowerCase().includes(q) ||
          l.leaveType?.toLowerCase().includes(q)
      );
    }

    const allRecords = await LeaveRequest.find().select('status approvalRoute requesterRole').lean();

    const counts = {
      all: allRecords.length,
      pendingAdmin: allRecords.filter((l) => l.status === 'pending' && l.approvalRoute === 'ADMIN').length,
      pendingManager: allRecords.filter((l) => l.status === 'pending' && l.approvalRoute === 'MANAGER').length,
      forwardedAdmin: allRecords.filter((l) => l.approvalRoute === 'ADMIN' && l.requesterRole === 'Employee').length,
      approved: allRecords.filter((l) => l.status === 'approved').length,
      rejected: allRecords.filter((l) => l.status === 'rejected').length,
      cancelled: allRecords.filter((l) => l.status === 'cancelled').length,
    };

    return res.json({
      leaves: filtered,
      counts,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Could not fetch leave requests.' });
  }
};

/**
 * POST /api/admin/leave/:id/override
 * Admin manual override to approve or reject any leave request directly.
 */
exports.adminOverrideLeave = async (req, res) => {
  try {
    if (req.userRole !== 'Admin') {
      return res.status(403).json({ message: 'Only an authorized Admin can perform a manual override.' });
    }

    const { id } = req.params;
    const { action, reason = '' } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Action must be "approve" or "reject".' });
    }

    const adminUser = await User.findById(req.userId);
    if (!adminUser) {
      return res.status(404).json({ message: 'Admin user not found.' });
    }

    const result = await leaveService.processLeaveDecision({
      isManualOverride: true,
      approverOverrideUser: adminUser,
      action,
      rejectionReason: reason,
      leaveRequestId: id,
    });

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    return res.json({
      message: `Leave request successfully ${result.action} via Admin override.`,
      leaveRequest: result.leaveRequest,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Admin override failed.' });
  }
};

/**
 * GET /api/manager/leave/team
 * Manager view of leave requests from their assigned employees.
 */
exports.getTeamLeavesForManager = async (req, res) => {
  try {
    if (!['Manager', 'Admin'].includes(req.userRole)) {
      return res.status(403).json({ message: 'Manager access required.' });
    }

    const managerId = req.userId;
    // Find all employees assigned to this manager
    const assignedEmployees = await User.find({ manager: managerId }).select('_id');
    const empIds = assignedEmployees.map((e) => e._id);

    const teamLeaves = await LeaveRequest.find({
      $or: [
        { assignedManager: managerId },
        { user: { $in: empIds } },
      ],
    })
      .populate('user', 'name email department designation employeeId role')
      .populate('approver', 'name email designation role')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      teamLeaves,
      counts: {
        total: teamLeaves.length,
        pendingWithMe: teamLeaves.filter((l) => l.status === 'pending' && l.approvalRoute === 'MANAGER').length,
        forwardedToAdmin: teamLeaves.filter((l) => l.approvalRoute === 'ADMIN').length,
        approved: teamLeaves.filter((l) => l.status === 'approved').length,
        rejected: teamLeaves.filter((l) => l.status === 'rejected').length,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Could not fetch team leave requests.' });
  }
};
