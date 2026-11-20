const Payroll = require('../models/Payroll');
const SalaryStructure = require('../models/SalaryStructure');
const User = require('../models/User');
const getManagerScope = require('../managerScope');
const { calculateMonthlySalary } = require('../services/salaryCalculationService');
const razorpayxService = require('../services/razorpayxService');

/**
 * Mask account number for UI/response security (e.g., ••••5678)
 */
const maskAccountNumber = (accNum) => {
  if (!accNum) return '';
  const str = String(accNum).trim();
  if (str.length <= 4) return str;
  return '••••' + str.slice(-4);
};

/**
 * Clean salary structure for response (masks account number)
 */
const sanitizeSalaryStructure = (structure) => {
  if (!structure) return null;
  const obj = structure.toObject ? structure.toObject() : { ...structure };
  if (obj.bankDetails?.accountNumber) {
    obj.bankDetails.maskedAccountNumber = maskAccountNumber(obj.bankDetails.accountNumber);
    // Keep accountNumber masked in standard payload
    obj.bankDetails.accountNumber = maskAccountNumber(obj.bankDetails.accountNumber);
  }
  return obj;
};

// ==========================================
// 1. SALARY STRUCTURE CONTROLLERS
// ==========================================

/**
 * GET /api/payroll/salary-structures
 * Admin only: Fetch all employee salary structures
 */
exports.getSalaryStructures = async (req, res) => {
  try {
    if (req.userRole !== 'Admin') {
      return res.status(403).json({ message: 'Only administrators can view salary structures.' });
    }

    const employees = await User.find({ role: 'Employee', isActive: { $ne: false } })
      .select('name firstName lastName email employeeId department designation team manager')
      .populate('manager', 'name email')
      .lean();

    const structures = await SalaryStructure.find().lean();
    const structureMap = {};
    structures.forEach((s) => {
      structureMap[String(s.employee)] = s;
    });

    const result = employees.map((emp) => {
      const existing = structureMap[String(emp._id)];
      return {
        employee: emp,
        structure: existing ? sanitizeSalaryStructure(existing) : null,
        hasConfiguredStructure: Boolean(existing)
      };
    });

    return res.json({ success: true, count: result.length, data: result });
  } catch (error) {
    console.error('getSalaryStructures error:', error);
    return res.status(500).json({ message: 'Failed to fetch salary structures.' });
  }
};

/**
 * GET /api/payroll/salary-structures/:employeeId
 * Admin, Manager (if scoped), or Employee (self)
 */
exports.getEmployeeSalaryStructure = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (req.userRole === 'Employee' && String(req.userId) !== String(employeeId)) {
      return res.status(403).json({ message: 'Employees can only view their own salary structure.' });
    }

    if (req.userRole === 'Manager') {
      const scope = await getManagerScope(req.userId);
      const isMember = scope?.memberIds?.some((id) => String(id) === String(employeeId));
      if (!isMember) {
        return res.status(403).json({ message: 'You can only view salary details for members of your assigned team.' });
      }
    }

    const structure = await SalaryStructure.findOne({ employee: employeeId })
      .populate('employee', 'name email employeeId department designation team manager')
      .lean();

    if (!structure) {
      return res.status(404).json({ message: 'No salary structure configured for this employee.' });
    }

    return res.json({ success: true, data: sanitizeSalaryStructure(structure) });
  } catch (error) {
    console.error('getEmployeeSalaryStructure error:', error);
    return res.status(500).json({ message: 'Failed to fetch salary structure.' });
  }
};

/**
 * POST /api/payroll/salary-structures
 * Admin only: Create or update salary structure for an employee
 */
exports.upsertSalaryStructure = async (req, res) => {
  try {
    if (req.userRole !== 'Admin') {
      return res.status(403).json({ message: 'Only administrators can configure salary structures.' });
    }

    const {
      employeeId,
      basicSalary = 30000,
      allowances = [],
      bonus = 0,
      deductions = [],
      bankDetails = {},
      paymentSchedule = 'monthly',
      isActive = true
    } = req.body;

    if (!employeeId) {
      return res.status(400).json({ message: 'Employee ID is required.' });
    }

    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee record not found.' });
    }

    // Preserve existing unmasked account number if user passed masked string back
    let existingStructure = await SalaryStructure.findOne({ employee: employeeId });
    let resolvedAccountNumber = bankDetails.accountNumber;
    if (resolvedAccountNumber && resolvedAccountNumber.startsWith('••••') && existingStructure?.bankDetails?.accountNumber) {
      resolvedAccountNumber = existingStructure.bankDetails.accountNumber;
    }

    const updatedBankDetails = {
      accountHolderName: bankDetails.accountHolderName || employee.name,
      accountNumber: resolvedAccountNumber || existingStructure?.bankDetails?.accountNumber || '',
      ifsc: (bankDetails.ifsc || existingStructure?.bankDetails?.ifsc || '').toUpperCase().trim(),
      bankName: bankDetails.bankName || existingStructure?.bankDetails?.bankName || '',
      upiId: bankDetails.upiId || existingStructure?.bankDetails?.upiId || ''
    };

    const updateData = {
      employee: employeeId,
      basicSalary: Math.max(0, Number(basicSalary) || 0),
      allowances: Array.isArray(allowances) ? allowances : [],
      bonus: Math.max(0, Number(bonus) || 0),
      deductions: Array.isArray(deductions) ? deductions : [],
      bankDetails: updatedBankDetails,
      paymentSchedule,
      isActive,
      updatedBy: req.userId
    };

    if (!existingStructure) {
      updateData.createdBy = req.userId;
    }

    const saved = await SalaryStructure.findOneAndUpdate(
      { employee: employeeId },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Salary structure updated successfully.',
      data: sanitizeSalaryStructure(saved)
    });
  } catch (error) {
    console.error('upsertSalaryStructure error:', error);
    return res.status(500).json({ message: 'Failed to save salary structure: ' + error.message });
  }
};

// ==========================================
// 2. PAYROLL GENERATION & REVIEW
// ==========================================

/**
 * POST /api/payroll/generate
 * Admin only: Generates monthly payroll for all active employees
 */
exports.generateMonthlyPayroll = async (req, res) => {
  try {
    if (req.userRole !== 'Admin') {
      return res.status(403).json({ message: 'Only administrators can generate monthly payroll.' });
    }

    const now = new Date();
    const periodMonth = Number(req.body.month) || (now.getMonth() + 1);
    const periodYear = Number(req.body.year) || now.getFullYear();

    if (periodMonth < 1 || periodMonth > 12) {
      return res.status(400).json({ message: 'Month must be between 1 and 12.' });
    }

    // Find all active employees
    const employees = await User.find({ role: 'Employee', isActive: { $ne: false } })
      .populate('manager', 'name email role')
      .lean();

    if (employees.length === 0) {
      return res.status(400).json({ message: 'No active employees found to generate payroll for.' });
    }

    const adminUser = await User.findById(req.userId).select('name email role').lean();
    const createdRecords = [];
    const skippedRecords = [];

    for (const emp of employees) {
      // Check if payroll already exists for this period
      const existing = await Payroll.findOne({
        employee: emp._id,
        periodMonth,
        periodYear
      });

      if (existing) {
        skippedRecords.push({
          employeeId: emp._id,
          name: emp.name,
          reason: `Payroll already generated for ${existing.periodLabel} (Status: ${existing.status})`
        });
        continue;
      }

      // Fetch or seed salary structure
      let structure = await SalaryStructure.findOne({ employee: emp._id });
      if (!structure) {
        // Create default structure if none configured
        structure = await SalaryStructure.create({
          employee: emp._id,
          basicSalary: 35000,
          allowances: [
            { name: 'House Rent Allowance (HRA)', amount: 14000 },
            { name: 'Special Allowance', amount: 5000 },
            { name: 'Conveyance Allowance', amount: 2000 }
          ],
          bonus: 0,
          deductions: [
            { name: 'Provident Fund (PF)', amount: 1800, type: 'fixed' },
            { name: 'Professional Tax (PT)', amount: 200, type: 'fixed' }
          ],
          bankDetails: {
            accountHolderName: emp.name,
            accountNumber: '112233445566',
            ifsc: 'HDFC0001234',
            bankName: 'HDFC Bank',
            upiId: `${(emp.firstName || emp.name).toLowerCase()}@okaxis`
          },
          createdBy: req.userId
        });
      }

      // Calculate salary using attendance & leaves
      const calculation = await calculateMonthlySalary(emp, structure, periodMonth, periodYear);

      // Initial status: if manager is assigned, go to Pending_Manager_Review.
      // Otherwise, go directly to Pending_Admin_Approval
      const initialStatus = emp.manager ? 'Pending_Manager_Review' : 'Pending_Admin_Approval';

      const payrollRecord = new Payroll({
        employee: emp._id,
        team: emp.team || 'General',
        department: emp.department || 'General',
        manager: emp.manager?._id || null,
        periodMonth,
        periodYear,
        periodLabel: calculation.periodLabel,
        salaryStructureSnapshot: calculation.salaryStructureSnapshot,
        attendanceSnapshot: calculation.attendanceSnapshot,
        earnings: calculation.earnings,
        deductions: calculation.deductions,
        grossSalary: calculation.grossSalary,
        totalDeductions: calculation.totalDeductions,
        netSalary: calculation.netSalary,
        status: initialStatus,
        managerReview: {
          status: emp.manager ? 'pending' : 'approved',
          reviewedBy: emp.manager ? null : req.userId,
          reviewedAt: emp.manager ? null : new Date(),
          remarks: emp.manager ? '' : 'Auto-routed to Admin (no manager assigned)'
        },
        adminApproval: {
          status: 'pending',
          approvedBy: null,
          approvedAt: null,
          remarks: ''
        },
        payout: {
          provider: 'RazorpayX',
          isTestMode: true,
          mode: 'IMPS',
          status: 'none'
        },
        auditLog: [
          {
            action: 'Payroll Generated',
            actor: req.userId,
            actorName: adminUser?.name || 'Administrator',
            actorRole: 'Admin',
            remarks: `Initial calculation for ${calculation.periodLabel}. Net salary: ₹${calculation.netSalary.toLocaleString('en-IN')}`,
            timestamp: new Date()
          }
        ],
        createdBy: req.userId
      });

      await payrollRecord.save();
      createdRecords.push({
        id: payrollRecord._id,
        employeeName: emp.name,
        netSalary: calculation.netSalary,
        status: initialStatus
      });
    }

    return res.status(201).json({
      success: true,
      message: `Payroll generation completed for ${periodMonth}/${periodYear}.`,
      generatedCount: createdRecords.length,
      skippedCount: skippedRecords.length,
      generated: createdRecords,
      skipped: skippedRecords
    });
  } catch (error) {
    console.error('generateMonthlyPayroll error:', error);
    return res.status(500).json({ message: 'Failed to generate monthly payroll: ' + error.message });
  }
};

/**
 * GET /api/payroll
 * Admin only: Fetch all payrolls with overview KPIs and filters
 */
exports.getAllPayrolls = async (req, res) => {
  try {
    if (req.userRole !== 'Admin') {
      return res.status(403).json({ message: 'Only administrators can access company-wide payrolls.' });
    }

    const { month, year, status, department, search } = req.query;
    const filter = {};

    if (month) filter.periodMonth = Number(month);
    if (year) filter.periodYear = Number(year);
    if (status) filter.status = status;
    if (department) filter.department = department;

    let payrolls = await Payroll.find(filter)
      .populate('employee', 'name firstName lastName email employeeId department designation team manager')
      .populate('manager', 'name email role')
      .populate('createdBy', 'name')
      .sort({ periodYear: -1, periodMonth: -1, createdAt: -1 })
      .lean();

    // Client-level search filter if requested
    if (search) {
      const q = search.toLowerCase().trim();
      payrolls = payrolls.filter((p) => {
        const empName = (p.employee?.name || '').toLowerCase();
        const empId = (p.employee?.employeeId || '').toLowerCase();
        const email = (p.employee?.email || '').toLowerCase();
        return empName.includes(q) || empId.includes(q) || email.includes(q);
      });
    }

    // Compute Overview KPI Metrics
    const totalPayrolls = payrolls.length;
    let totalGrossAmount = 0;
    let totalNetAmount = 0;
    let pendingManagerCount = 0;
    let pendingAdminCount = 0;
    let readyForPaymentCount = 0;
    let processingCount = 0;
    let paidCount = 0;
    let failedCount = 0;

    payrolls.forEach((p) => {
      totalGrossAmount += p.grossSalary || 0;
      totalNetAmount += p.netSalary || 0;
      if (p.status === 'Pending_Manager_Review') pendingManagerCount++;
      else if (p.status === 'Manager_Approved' || p.status === 'Pending_Admin_Approval') pendingAdminCount++;
      else if (p.status === 'Ready_for_Payment') readyForPaymentCount++;
      else if (p.status === 'Processing') processingCount++;
      else if (p.status === 'Paid') paidCount++;
      else if (p.status === 'Failed') failedCount++;
    });

    const kpiOverview = {
      totalPayrolls,
      totalGrossAmount,
      totalNetAmount,
      pendingManagerCount,
      pendingAdminCount,
      readyForPaymentCount,
      processingCount,
      paidCount,
      failedCount
    };

    return res.json({
      success: true,
      kpis: kpiOverview,
      count: payrolls.length,
      data: payrolls
    });
  } catch (error) {
    console.error('getAllPayrolls error:', error);
    return res.status(500).json({ message: 'Failed to fetch payroll list.' });
  }
};

/**
 * GET /api/payroll/team
 * Manager only: View payroll records strictly scoped to their assigned team
 */
exports.getTeamPayrolls = async (req, res) => {
  try {
    if (req.userRole !== 'Manager') {
      return res.status(403).json({ message: 'Only managers can access team payroll review.' });
    }

    const scope = await getManagerScope(req.userId);
    if (!scope) {
      return res.status(403).json({ message: 'Manager profile or assigned team not found.' });
    }

    const employeeIds = scope.employees.map((e) => e._id);
    const { month, year, status } = req.query;

    const filter = {
      employee: { $in: employeeIds }
    };

    if (month) filter.periodMonth = Number(month);
    if (year) filter.periodYear = Number(year);
    if (status) filter.status = status;

    const payrolls = await Payroll.find(filter)
      .populate('employee', 'name firstName lastName email employeeId department designation team manager')
      .populate('manager', 'name email')
      .sort({ periodYear: -1, periodMonth: -1, createdAt: -1 })
      .lean();

    let pendingCount = 0;
    let approvedCount = 0;
    let correctionCount = 0;

    payrolls.forEach((p) => {
      if (p.status === 'Pending_Manager_Review') pendingCount++;
      else if (p.status === 'Manager_Approved' || p.status === 'Ready_for_Payment' || p.status === 'Paid') approvedCount++;
      else if (p.status === 'Manager_Correction_Requested') correctionCount++;
    });

    return res.json({
      success: true,
      teamOverview: {
        totalTeamMembers: scope.employees.length,
        department: scope.manager.department,
        pendingReviewCount: pendingCount,
        approvedCount,
        correctionCount
      },
      count: payrolls.length,
      data: payrolls
    });
  } catch (error) {
    console.error('getTeamPayrolls error:', error);
    return res.status(500).json({ message: 'Failed to fetch team payrolls.' });
  }
};

/**
 * GET /api/payroll/my
 * Employee only: View their own salary history & payslips
 */
exports.getMyPayrolls = async (req, res) => {
  try {
    const payrolls = await Payroll.find({ employee: req.userId })
      .populate('employee', 'name firstName lastName email employeeId department designation team')
      .populate('manager', 'name email')
      .sort({ periodYear: -1, periodMonth: -1 })
      .lean();

    return res.json({
      success: true,
      count: payrolls.length,
      data: payrolls
    });
  } catch (error) {
    console.error('getMyPayrolls error:', error);
    return res.status(500).json({ message: 'Failed to fetch personal payroll history.' });
  }
};

/**
 * GET /api/payroll/:id
 * Role-authorized detail inspection
 */
exports.getPayrollById = async (req, res) => {
  try {
    const { id } = req.params;
    const payroll = await Payroll.findById(id)
      .populate('employee', 'name firstName lastName email employeeId department designation team manager')
      .populate('manager', 'name email role')
      .populate('managerReview.reviewedBy', 'name email')
      .populate('adminApproval.approvedBy', 'name email')
      .lean();

    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found.' });
    }

    // Role-based authorization
    if (req.userRole === 'Employee' && String(payroll.employee._id) !== String(req.userId)) {
      return res.status(403).json({ message: 'You are not authorized to view another employee’s payroll.' });
    }

    if (req.userRole === 'Manager') {
      const scope = await getManagerScope(req.userId);
      const isMember = scope?.memberIds?.some((mid) => String(mid) === String(payroll.employee._id));
      if (!isMember) {
        return res.status(403).json({ message: 'You can only review payroll for members of your assigned team.' });
      }
    }

    return res.json({ success: true, data: payroll });
  } catch (error) {
    console.error('getPayrollById error:', error);
    return res.status(500).json({ message: 'Failed to fetch payroll record.' });
  }
};

// ==========================================
// 3. APPROVAL & CORRECTION WORKFLOWS
// ==========================================

/**
 * POST /api/payroll/:id/manager-review
 * Manager: Approve or Request Correction for a team member's payroll
 */
exports.managerReviewPayroll = async (req, res) => {
  try {
    if (req.userRole !== 'Manager') {
      return res.status(403).json({ message: 'Only authorized managers can perform team payroll reviews.' });
    }

    const { id } = req.params;
    const { decision, remarks = '' } = req.body; // 'approved' | 'correction_requested'

    if (!['approved', 'correction_requested'].includes(decision)) {
      return res.status(400).json({ message: "Decision must be 'approved' or 'correction_requested'." });
    }

    const payroll = await Payroll.findById(id).populate('employee', 'name employeeId department');
    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found.' });
    }

    // Verify manager scope
    const scope = await getManagerScope(req.userId);
    const isMember = scope?.memberIds?.some((mid) => String(mid) === String(payroll.employee?._id || payroll.employee));
    if (!isMember) {
      return res.status(403).json({ message: 'You can only review payroll for your assigned team members.' });
    }

    const managerUser = await User.findById(req.userId).select('name email role').lean();
    const isApproved = decision === 'approved';

    payroll.managerReview = {
      status: isApproved ? 'approved' : 'correction_requested',
      reviewedBy: req.userId,
      reviewedAt: new Date(),
      remarks
    };

    payroll.status = isApproved ? 'Manager_Approved' : 'Manager_Correction_Requested';

    payroll.auditLog.push({
      action: isApproved ? 'Manager Approval' : 'Correction Requested by Manager',
      actor: req.userId,
      actorName: managerUser?.name || 'Manager',
      actorRole: 'Manager',
      remarks: remarks || (isApproved ? 'Approved for Admin final verification.' : 'Correction requested on payroll inputs.'),
      timestamp: new Date()
    });

    await payroll.save();

    if (isApproved) {
      try {
        const AdminNotification = require('../models/AdminNotification');
        await AdminNotification.create({
          title: 'Manager Approved Payroll',
          message: `${managerUser?.name || 'Manager'} verified and approved ${payroll.periodLabel} salary calculation for ${payroll.employee?.name || 'Employee'} (₹${Number(payroll.netSalary).toLocaleString('en-IN')}). Ready for Admin sign-off.`,
          type: 'general',
          priority: 'Medium',
          sender: req.userId,
          employee: payroll.employee?._id || payroll.employee,
          isRead: false
        });
      } catch (notifErr) {
        console.warn('AdminNotification creation warning:', notifErr.message);
      }
    }

    return res.json({
      success: true,
      message: isApproved ? 'Payroll approved and forwarded to Admin.' : 'Correction request submitted.',
      data: payroll
    });
  } catch (error) {
    console.error('managerReviewPayroll error:', error);
    return res.status(500).json({ message: 'Failed to process manager review.' });
  }
};

/**
 * POST /api/payroll/team/bulk-approve
 * Manager: Bulk approve all pending payrolls for their team in one action
 */
exports.managerBulkApprove = async (req, res) => {
  try {
    if (req.userRole !== 'Manager') {
      return res.status(403).json({ message: 'Only managers can bulk approve team payroll.' });
    }

    const scope = await getManagerScope(req.userId);
    if (!scope) {
      return res.status(403).json({ message: 'Manager scope not found.' });
    }

    const { month, year, remarks = 'Team bulk approval verified.' } = req.body;
    const employeeIds = scope.employees.map((e) => e._id);

    const filter = {
      employee: { $in: employeeIds },
      status: 'Pending_Manager_Review'
    };

    if (month) filter.periodMonth = Number(month);
    if (year) filter.periodYear = Number(year);

    const pendingPayrolls = await Payroll.find(filter);
    if (pendingPayrolls.length === 0) {
      return res.status(400).json({ message: 'No pending payrolls found to approve.' });
    }

    const managerUser = await User.findById(req.userId).select('name role').lean();

    for (const p of pendingPayrolls) {
      p.managerReview = {
        status: 'approved',
        reviewedBy: req.userId,
        reviewedAt: new Date(),
        remarks
      };
      p.status = 'Manager_Approved';
      p.auditLog.push({
        action: 'Manager Bulk Approval',
        actor: req.userId,
        actorName: managerUser?.name || 'Manager',
        actorRole: 'Manager',
        remarks,
        timestamp: new Date()
      });
      await p.save();
    }

    return res.json({
      success: true,
      message: `Successfully approved ${pendingPayrolls.length} team payroll records.`,
      approvedCount: pendingPayrolls.length
    });
  } catch (error) {
    console.error('managerBulkApprove error:', error);
    return res.status(500).json({ message: 'Failed to bulk approve payrolls.' });
  }
};

/**
 * POST /api/payroll/:id/admin-review
 * Admin: Final approval or rejection/send-back
 */
exports.adminReviewPayroll = async (req, res) => {
  try {
    if (req.userRole !== 'Admin') {
      return res.status(403).json({ message: 'Only administrators can perform final payroll approvals.' });
    }

    const { id } = req.params;
    const { decision, remarks = '' } = req.body; // 'approved' | 'rejected'

    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ message: "Decision must be 'approved' or 'rejected'." });
    }

    const payroll = await Payroll.findById(id).populate('employee', 'name employeeId department');
    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found.' });
    }

    const adminUser = await User.findById(req.userId).select('name email role').lean();
    const isApproved = decision === 'approved';

    payroll.adminApproval = {
      status: isApproved ? 'approved' : 'rejected',
      approvedBy: req.userId,
      approvedAt: new Date(),
      remarks
    };

    // When approved by Admin, it moves to 'Ready_for_Payment'
    payroll.status = isApproved ? 'Ready_for_Payment' : 'Admin_Rejected';

    payroll.auditLog.push({
      action: isApproved ? 'Admin Final Approval' : 'Admin Rejection',
      actor: req.userId,
      actorName: adminUser?.name || 'Administrator',
      actorRole: 'Admin',
      remarks: remarks || (isApproved ? 'Approved for payout processing.' : 'Rejected by administrator.'),
      timestamp: new Date()
    });

    await payroll.save();

    if (isApproved) {
      try {
        const AdminNotification = require('../models/AdminNotification');
        await AdminNotification.create({
          title: 'Salary Approved for Disbursement',
          message: `Salary for ${payroll.employee?.name || 'Employee'} (${payroll.periodLabel}, ₹${Number(payroll.netSalary).toLocaleString('en-IN')}) has been approved and is Ready for Payment via Razorpay.`,
          type: 'general',
          priority: 'High',
          sender: req.userId,
          employee: payroll.employee?._id || payroll.employee,
          isRead: false
        });
      } catch (notifErr) {
        console.warn('AdminNotification creation warning:', notifErr.message);
      }
    }

    return res.json({
      success: true,
      message: isApproved ? 'Payroll approved and marked Ready for Payment.' : 'Payroll rejected by Admin.',
      data: payroll
    });
  } catch (error) {
    console.error('adminReviewPayroll error:', error);
    return res.status(500).json({ message: 'Failed to process admin review.' });
  }
};

/**
 * POST /api/payroll/:id/recalculate
 * Admin only: Recalculates payroll numbers prior to final payout
 */
exports.recalculatePayroll = async (req, res) => {
  try {
    if (req.userRole !== 'Admin') {
      return res.status(403).json({ message: 'Only administrators can recalculate payroll.' });
    }

    const { id } = req.params;
    const payroll = await Payroll.findById(id);
    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found.' });
    }

    if (payroll.status === 'Paid' || payroll.status === 'Processing') {
      return res.status(400).json({ message: 'Cannot recalculate a payroll that is currently processing or already paid.' });
    }

    const employee = await User.findById(payroll.employee);
    const structure = await SalaryStructure.findOne({ employee: payroll.employee });
    const adminUser = await User.findById(req.userId).select('name role').lean();

    const calculation = await calculateMonthlySalary(employee, structure, payroll.periodMonth, payroll.periodYear);

    payroll.salaryStructureSnapshot = calculation.salaryStructureSnapshot;
    payroll.attendanceSnapshot = calculation.attendanceSnapshot;
    payroll.earnings = calculation.earnings;
    payroll.deductions = calculation.deductions;
    payroll.grossSalary = calculation.grossSalary;
    payroll.totalDeductions = calculation.totalDeductions;
    payroll.netSalary = calculation.netSalary;

    payroll.auditLog.push({
      action: 'Payroll Recalculated',
      actor: req.userId,
      actorName: adminUser?.name || 'Administrator',
      actorRole: 'Admin',
      remarks: `Recalculated with updated attendance/leave records. New net salary: ₹${calculation.netSalary.toLocaleString('en-IN')}`,
      timestamp: new Date()
    });

    await payroll.save();

    return res.json({
      success: true,
      message: 'Payroll recalculated successfully.',
      data: payroll
    });
  } catch (error) {
    console.error('recalculatePayroll error:', error);
    return res.status(500).json({ message: 'Failed to recalculate payroll.' });
  }
};

// ==========================================
// 4. RAZORPAYX PAYOUT INITIATION & RETRY
// ==========================================

/**
 * POST /api/payroll/:id/initiate-payout
 * Admin only: Execute outbound RazorpayX salary transfer
 */
exports.initiatePayout = async (req, res) => {
  try {
    if (req.userRole !== 'Admin') {
      return res.status(403).json({ message: 'Only administrators can initiate salary payouts.' });
    }

    const { id } = req.params;
    const { transferMode = 'IMPS' } = req.body;

    const payroll = await Payroll.findById(id).populate('employee');
    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found.' });
    }

    // Safety checks
    if (payroll.status === 'Paid') {
      return res.status(400).json({ message: 'This payroll has already been paid successfully.' });
    }
    if (payroll.status === 'Processing') {
      return res.status(400).json({ message: 'A payout is already currently in progress for this record.' });
    }
    if (!['Ready_for_Payment', 'Failed'].includes(payroll.status)) {
      return res.status(400).json({ message: `Cannot initiate payout. Current status is '${payroll.status}'. Must be 'Ready_for_Payment'.` });
    }

    const adminUser = await User.findById(req.userId).select('name role').lean();
    const structure = await SalaryStructure.findOne({ employee: payroll.employee._id });
    const bankDetails = structure?.bankDetails || {};

    // Temporary optimistic lock state
    payroll.status = 'Processing';
    payroll.payout.status = 'processing';
    payroll.payout.initiatedBy = req.userId;
    payroll.payout.initiatedAt = new Date();
    payroll.payout.mode = transferMode;
    payroll.payout.attempts = (payroll.payout.attempts || 0) + 1;
    await payroll.save();

    const idempotencyKey = `TF_PAYOUT_${payroll._id}_ATTEMPT_${payroll.payout.attempts}`;

    // Execute through RazorpayX service
    const payoutResult = await razorpayxService.initiateSalaryPayout({
      payroll,
      employee: payroll.employee,
      bankDetails,
      transferMode,
      idempotencyKey
    });

    if (payoutResult.success) {
      payroll.status = payoutResult.status === 'processed' ? 'Paid' : 'Processing';
      payroll.payout.status = payoutResult.status;
      payroll.payout.payoutId = payoutResult.payoutId;
      payroll.payout.isTestMode = payoutResult.isTestMode;
      payroll.payout.utr = payoutResult.utr;
      payroll.payout.processedAt = new Date();
      payroll.payout.safeMetadata = payoutResult.safeMetadata;

      payroll.auditLog.push({
        action: 'RazorpayX Payout Initiated',
        actor: req.userId,
        actorName: adminUser?.name || 'Administrator',
        actorRole: 'Admin',
        remarks: `Payout ID: ${payoutResult.payoutId} | Status: ${payoutResult.status} | Mode: ${transferMode} | UTR: ${payoutResult.utr || 'Pending'}`,
        timestamp: new Date()
      });

      await payroll.save();

      try {
        const AdminNotification = require('../models/AdminNotification');
        await AdminNotification.create({
          title: '💰 Salary Disbursed via Razorpay',
          message: `Payment of ₹${Number(payroll.netSalary).toLocaleString('en-IN')} for ${payroll.employee?.name || 'Employee'} (${payroll.periodLabel}) was successfully credited via Razorpay.${payroll.payout?.utr ? ` UTR: ${payroll.payout.utr}` : ''}`,
          type: 'general',
          priority: 'High',
          sender: req.userId,
          employee: payroll.employee?._id || payroll.employee,
          isRead: false
        });
      } catch (notifErr) {
        console.warn('AdminNotification creation warning:', notifErr.message);
      }

      return res.json({
        success: true,
        message: `Salary payout initiated successfully via ${payoutResult.isTestMode ? 'Test Sandbox' : 'RazorpayX'}.`,
        data: payroll
      });
    } else {
      payroll.status = 'Failed';
      payroll.payout.status = 'failed';
      payroll.payout.failureReason = payoutResult.failureReason;
      payroll.payout.safeMetadata = payoutResult.safeMetadata;

      payroll.auditLog.push({
        action: 'Payout Failed',
        actor: req.userId,
        actorName: adminUser?.name || 'Administrator',
        actorRole: 'Admin',
        remarks: `Failure: ${payoutResult.failureReason}`,
        timestamp: new Date()
      });

      await payroll.save();

      return res.status(400).json({
        success: false,
        message: 'Payout failed: ' + payoutResult.failureReason,
        data: payroll
      });
    }
  } catch (error) {
    console.error('initiatePayout error:', error);
    return res.status(500).json({ message: 'Internal payout error: ' + error.message });
  }
};

/**
 * POST /api/payroll/batch/initiate-payouts
 * Admin only: Process a batch of approved payrolls safely
 */
exports.batchInitiatePayouts = async (req, res) => {
  try {
    if (req.userRole !== 'Admin') {
      return res.status(403).json({ message: 'Only administrators can initiate batch payouts.' });
    }

    const { payrollIds = [], transferMode = 'IMPS' } = req.body;
    if (!Array.isArray(payrollIds) || payrollIds.length === 0) {
      return res.status(400).json({ message: 'An array of payroll IDs is required.' });
    }

    const adminUser = await User.findById(req.userId).select('name role').lean();
    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (const pid of payrollIds) {
      const payroll = await Payroll.findById(pid).populate('employee');
      if (!payroll) {
        results.push({ id: pid, status: 'skipped', reason: 'Record not found' });
        continue;
      }

      if (payroll.status === 'Paid') {
        results.push({ id: pid, name: payroll.employee?.name, status: 'skipped', reason: 'Already paid' });
        continue;
      }

      if (!['Ready_for_Payment', 'Failed'].includes(payroll.status)) {
        results.push({ id: pid, name: payroll.employee?.name, status: 'skipped', reason: `Status is ${payroll.status}` });
        continue;
      }

      const structure = await SalaryStructure.findOne({ employee: payroll.employee._id });
      const bankDetails = structure?.bankDetails || {};

      payroll.status = 'Processing';
      payroll.payout.status = 'processing';
      payroll.payout.initiatedBy = req.userId;
      payroll.payout.initiatedAt = new Date();
      payroll.payout.mode = transferMode;
      payroll.payout.attempts = (payroll.payout.attempts || 0) + 1;
      await payroll.save();

      const idempotencyKey = `TF_BATCH_PAY_${payroll._id}_${Date.now()}`;

      const resPayout = await razorpayxService.initiateSalaryPayout({
        payroll,
        employee: payroll.employee,
        bankDetails,
        transferMode,
        idempotencyKey
      });

      if (resPayout.success) {
        payroll.status = resPayout.status === 'processed' ? 'Paid' : 'Processing';
        payroll.payout.status = resPayout.status;
        payroll.payout.payoutId = resPayout.payoutId;
        payroll.payout.isTestMode = resPayout.isTestMode;
        payroll.payout.utr = resPayout.utr;
        payroll.payout.processedAt = new Date();
        payroll.payout.safeMetadata = resPayout.safeMetadata;

        payroll.auditLog.push({
          action: 'Batch Payout Processed',
          actor: req.userId,
          actorName: adminUser?.name || 'Administrator',
          actorRole: 'Admin',
          remarks: `UTR: ${resPayout.utr} | Payout ID: ${resPayout.payoutId}`,
          timestamp: new Date()
        });

        await payroll.save();
        successCount++;
        results.push({ id: pid, name: payroll.employee?.name, status: 'success', utr: resPayout.utr });
      } else {
        payroll.status = 'Failed';
        payroll.payout.status = 'failed';
        payroll.payout.failureReason = resPayout.failureReason;
        payroll.payout.safeMetadata = resPayout.safeMetadata;

        payroll.auditLog.push({
          action: 'Batch Payout Failed',
          actor: req.userId,
          actorName: adminUser?.name || 'Administrator',
          actorRole: 'Admin',
          remarks: `Failure: ${resPayout.failureReason}`,
          timestamp: new Date()
        });

        await payroll.save();
        failedCount++;
        results.push({ id: pid, name: payroll.employee?.name, status: 'failed', reason: resPayout.failureReason });
      }
    }

    return res.json({
      success: true,
      message: `Batch payout processing complete. Succeeded: ${successCount}, Failed: ${failedCount}.`,
      totalRequested: payrollIds.length,
      successCount,
      failedCount,
      results
    });
  } catch (error) {
    console.error('batchInitiatePayouts error:', error);
    return res.status(500).json({ message: 'Batch payout failed: ' + error.message });
  }
};

/**
 * POST /api/payroll/:id/retry-payout
 * Admin only: Safe retry for a failed payout
 */
exports.retryPayout = async (req, res) => {
  try {
    if (req.userRole !== 'Admin') {
      return res.status(403).json({ message: 'Only administrators can retry payouts.' });
    }

    const { id } = req.params;
    const payroll = await Payroll.findById(id).populate('employee');
    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found.' });
    }

    if (payroll.status === 'Paid') {
      return res.status(400).json({ message: 'Payout is already marked as Paid. Cannot retry.' });
    }

    if (payroll.status !== 'Failed') {
      return res.status(400).json({ message: `Only failed payouts can be retried. Current status is ${payroll.status}.` });
    }

    const adminUser = await User.findById(req.userId).select('name role').lean();
    const structure = await SalaryStructure.findOne({ employee: payroll.employee._id });
    const bankDetails = structure?.bankDetails || {};

    payroll.status = 'Processing';
    payroll.payout.status = 'processing';
    payroll.payout.attempts = (payroll.payout.attempts || 0) + 1;
    await payroll.save();

    const idempotencyKey = `TF_RETRY_${payroll._id}_${payroll.payout.attempts}`;

    const payoutResult = await razorpayxService.initiateSalaryPayout({
      payroll,
      employee: payroll.employee,
      bankDetails,
      transferMode: payroll.payout.mode || 'IMPS',
      idempotencyKey
    });

    if (payoutResult.success) {
      payroll.status = payoutResult.status === 'processed' ? 'Paid' : 'Processing';
      payroll.payout.status = payoutResult.status;
      payroll.payout.payoutId = payoutResult.payoutId;
      payroll.payout.isTestMode = payoutResult.isTestMode;
      payroll.payout.utr = payoutResult.utr;
      payroll.payout.failureReason = null;
      payroll.payout.processedAt = new Date();
      payroll.payout.safeMetadata = payoutResult.safeMetadata;

      payroll.auditLog.push({
        action: 'Payout Retry Succeeded',
        actor: req.userId,
        actorName: adminUser?.name || 'Administrator',
        actorRole: 'Admin',
        remarks: `Retry attempt #${payroll.payout.attempts} succeeded. UTR: ${payoutResult.utr}`,
        timestamp: new Date()
      });

      await payroll.save();
      return res.json({ success: true, message: 'Payout retried successfully.', data: payroll });
    } else {
      payroll.status = 'Failed';
      payroll.payout.status = 'failed';
      payroll.payout.failureReason = payoutResult.failureReason;

      payroll.auditLog.push({
        action: 'Payout Retry Failed',
        actor: req.userId,
        actorName: adminUser?.name || 'Administrator',
        actorRole: 'Admin',
        remarks: `Retry attempt #${payroll.payout.attempts} failed: ${payoutResult.failureReason}`,
        timestamp: new Date()
      });

      await payroll.save();
      return res.status(400).json({ success: false, message: 'Retry failed: ' + payoutResult.failureReason });
    }
  } catch (error) {
    console.error('retryPayout error:', error);
    return res.status(500).json({ message: 'Retry operation failed.' });
  }
};

/**
 * GET /api/payroll/status/gateway
 * Informational: RazorpayX connection status & test mode instructions
 */
exports.getGatewayStatus = async (req, res) => {
  try {
    const creds = razorpayxService.getCredentials();
    return res.json({
      success: true,
      mode: creds.mode,
      isRealApiConfigured: creds.isRealApiConfigured,
      keyIdMasked: creds.keyId ? `${creds.keyId.slice(0, 8)}••••` : 'rzp_test_sandbox (automatic)',
      accountNumberMasked: maskAccountNumber(creds.accountNumber),
      message: creds.isRealApiConfigured
        ? 'Connected to configured RazorpayX API credentials.'
        : 'Automatic High-Fidelity Test Mode Sandbox is active. Outbound payouts are simulated instantly with realistic banking UTRs without needing external credentials.'
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to inspect gateway status.' });
  }
};

/**
 * POST /api/payroll/webhook
 * RazorpayX Webhook receiver
 */
exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const event = req.body;

    console.log('[RazorpayX Webhook Received]:', event?.event);

    if (event?.event === 'payout.processed' && event.payload?.payout?.entity) {
      const payoutEntity = event.payload.payout.entity;
      const payoutId = payoutEntity.id;
      const utr = payoutEntity.utr;

      const payroll = await Payroll.findOne({ 'payout.payoutId': payoutId });
      if (payroll && payroll.status !== 'Paid') {
        payroll.status = 'Paid';
        payroll.payout.status = 'processed';
        payroll.payout.utr = utr || payroll.payout.utr;
        payroll.payout.processedAt = new Date();
        payroll.auditLog.push({
          action: 'Webhook Confirmation',
          actorName: 'RazorpayX Webhook',
          actorRole: 'System',
          remarks: `Payout verified processed via webhook. UTR: ${utr}`,
          timestamp: new Date()
        });
        await payroll.save();
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(200).json({ status: 'ignored' });
  }
};

// ==========================================
// 5. INTERACTIVE RAZORPAY CHECKOUT PAYMENTS
// ==========================================

/**
 * POST /api/payroll/:id/create-razorpay-order
 * Admin only: Create official Razorpay order for interactive checkout payment
 */
exports.createRazorpayOrder = async (req, res) => {
  try {
    if (req.userRole !== 'Admin') {
      return res.status(403).json({ message: 'Only administrators can initiate salary payments.' });
    }

    const { id } = req.params;
    const payroll = await Payroll.findById(id).populate('employee', 'name email department phone');
    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found.' });
    }

    if (payroll.status === 'Paid') {
      return res.status(400).json({ message: 'This payroll record is already Paid.' });
    }

    const orderData = await razorpayxService.createPaymentOrder({
      amount: payroll.netSalary,
      currency: 'INR',
      receipt: `TF_PAY_${payroll._id.toString().slice(-14)}`,
      notes: {
        payrollId: String(payroll._id),
        employeeName: payroll.employee?.name || 'Employee',
        employeeEmail: payroll.employee?.email || '',
        period: payroll.periodLabel,
        system: 'Taskflow'
      }
    });

    return res.json({
      success: true,
      orderId: orderData.orderId,
      amount: orderData.amount,
      currency: orderData.currency,
      keyId: orderData.keyId,
      employeeName: payroll.employee?.name || 'Employee',
      periodLabel: payroll.periodLabel,
      netSalary: payroll.netSalary,
      payrollId: String(payroll._id)
    });
  } catch (error) {
    console.error('[Razorpay Order Creation Error]:', error.response?.data || error.message);
    const desc = error.response?.data?.error?.description || error.message || 'Failed to create Razorpay payment order.';
    return res.status(500).json({ message: desc });
  }
};

/**
 * POST /api/payroll/verify-razorpay-payment
 * Admin only: Verify signature and mark salary as Paid
 */
exports.verifyRazorpayPayment = async (req, res) => {
  try {
    if (req.userRole !== 'Admin') {
      return res.status(403).json({ message: 'Only administrators can verify salary payments.' });
    }

    const { payrollId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!payrollId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing required Razorpay payment verification parameters.' });
    }

    const isValid = razorpayxService.verifyPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature
    });

    if (!isValid) {
      return res.status(400).json({ message: 'Cryptographic signature mismatch. Payment verification failed.' });
    }

    const payroll = await Payroll.findById(payrollId).populate('employee', 'name email department');
    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found.' });
    }

    const adminUser = await User.findById(req.userId).select('name role');

    payroll.status = 'Paid';
    payroll.payout.status = 'processed';
    payroll.payout.provider = 'Razorpay Test Gateway';
    payroll.payout.payoutId = razorpay_payment_id;
    payroll.payout.utr = `RZP${razorpay_payment_id.slice(-8).toUpperCase()}`;
    payroll.payout.processedAt = new Date();
    payroll.payout.isTestMode = true;
    payroll.payout.safeMetadata = {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      verificationMode: 'HMAC_SHA256_AUTHENTICATED',
      capturedAt: new Date()
    };

    payroll.auditLog.push({
      action: 'Razorpay Payment Completed',
      actor: req.userId,
      actorName: adminUser?.name || 'Administrator',
      actorRole: 'Admin',
      remarks: `Paid via Razorpay Test Checkout. Payment ID: ${razorpay_payment_id} | Order ID: ${razorpay_order_id}`,
      timestamp: new Date()
    });

    await payroll.save();

    try {
      const AdminNotification = require('../models/AdminNotification');
      await AdminNotification.create({
        title: '💰 Salary Disbursed via Razorpay',
        message: `Payment of ₹${Number(payroll.netSalary).toLocaleString('en-IN')} for ${payroll.employee?.name || 'Employee'} (${payroll.periodLabel}) was successfully credited via Razorpay.${payroll.payout?.utr ? ` UTR: ${payroll.payout.utr}` : ''}`,
        type: 'general',
        priority: 'High',
        sender: req.userId,
        employee: payroll.employee?._id || payroll.employee,
        isRead: false
      });
    } catch (notifErr) {
      console.warn('AdminNotification creation warning:', notifErr.message);
    }

    return res.json({
      success: true,
      message: `Payment of ₹${payroll.netSalary.toLocaleString('en-IN')} successfully captured via Razorpay!`,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      payroll
    });
  } catch (error) {
    console.error('[Razorpay Verify Error]:', error);
    return res.status(500).json({ message: 'Failed to verify Razorpay payment.' });
  }
};

/**
 * POST /api/payroll/batch/create-razorpay-order
 * Admin only: Create combined order for all Ready_for_Payment records
 */
exports.batchCreateRazorpayOrder = async (req, res) => {
  try {
    if (req.userRole !== 'Admin') {
      return res.status(403).json({ message: 'Only administrators can initiate salary payments.' });
    }

    const { month, year } = req.body;
    const targetMonth = Number(month) || (new Date().getMonth() + 1);
    const targetYear = Number(year) || new Date().getFullYear();

    const pendingPayrolls = await Payroll.find({
      periodMonth: targetMonth,
      periodYear: targetYear,
      status: 'Ready_for_Payment'
    }).populate('employee', 'name email');

    if (pendingPayrolls.length === 0) {
      return res.status(400).json({ message: 'No records currently Ready for Payment in this period.' });
    }

    const totalNetSalary = pendingPayrolls.reduce((sum, p) => sum + Number(p.netSalary || 0), 0);

    const orderData = await razorpayxService.createPaymentOrder({
      amount: totalNetSalary,
      currency: 'INR',
      receipt: `TF_BATCH_${targetMonth}_${targetYear}_${Date.now().toString().slice(-6)}`,
      notes: {
        batchCount: String(pendingPayrolls.length),
        period: `${MONTH_NAMES[targetMonth - 1]} ${targetYear}`,
        system: 'Taskflow'
      }
    });

    return res.json({
      success: true,
      orderId: orderData.orderId,
      amount: orderData.amount,
      currency: orderData.currency,
      keyId: orderData.keyId,
      count: pendingPayrolls.length,
      totalNetSalary,
      month: targetMonth,
      year: targetYear
    });
  } catch (error) {
    console.error('[Batch Razorpay Order Error]:', error.response?.data || error.message);
    const desc = error.response?.data?.error?.description || error.message || 'Failed to create batch Razorpay order.';
    return res.status(500).json({ message: desc });
  }
};

/**
 * POST /api/payroll/batch/verify-razorpay-payment
 * Admin only: Verify batch payment signature and mark all matching records as Paid
 */
exports.batchVerifyRazorpayPayment = async (req, res) => {
  try {
    if (req.userRole !== 'Admin') {
      return res.status(403).json({ message: 'Only administrators can verify salary payments.' });
    }

    const { month, year, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing required Razorpay payment verification parameters.' });
    }

    const isValid = razorpayxService.verifyPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature
    });

    if (!isValid) {
      return res.status(400).json({ message: 'Cryptographic signature mismatch. Batch payment verification failed.' });
    }

    const targetMonth = Number(month) || (new Date().getMonth() + 1);
    const targetYear = Number(year) || new Date().getFullYear();

    const pendingPayrolls = await Payroll.find({
      periodMonth: targetMonth,
      periodYear: targetYear,
      status: 'Ready_for_Payment'
    });

    const adminUser = await User.findById(req.userId).select('name role');

    for (const p of pendingPayrolls) {
      p.status = 'Paid';
      p.payout.status = 'processed';
      p.payout.provider = 'Razorpay Test Gateway';
      p.payout.payoutId = razorpay_payment_id;
      p.payout.utr = `RZPB_${razorpay_payment_id.slice(-8).toUpperCase()}`;
      p.payout.processedAt = new Date();
      p.payout.isTestMode = true;
      p.payout.safeMetadata = {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        batchDisbursement: true,
        capturedAt: new Date()
      };
      p.auditLog.push({
        action: 'Batch Razorpay Payment Completed',
        actor: req.userId,
        actorName: adminUser?.name || 'Administrator',
        actorRole: 'Admin',
        remarks: `Disbursed via Batch Razorpay Test Checkout. Payment ID: ${razorpay_payment_id}`,
        timestamp: new Date()
      });
      await p.save();
    }

    try {
      const AdminNotification = require('../models/AdminNotification');
      const totalNet = pendingPayrolls.reduce((sum, p) => sum + Number(p.netSalary || 0), 0);
      await AdminNotification.create({
        title: '💰 Batch Salary Disbursed via Razorpay',
        message: `Batch payout of ₹${totalNet.toLocaleString('en-IN')} for ${pendingPayrolls.length} team members (${MONTH_NAMES[targetMonth - 1]} ${targetYear}) was successfully credited via Razorpay. Payment ID: ${razorpay_payment_id}`,
        type: 'general',
        priority: 'High',
        sender: req.userId,
        isRead: false
      });
    } catch (notifErr) {
      console.warn('AdminNotification creation warning:', notifErr.message);
    }

    return res.json({
      success: true,
      message: `Batch payment of ${pendingPayrolls.length} employee salaries successfully completed and verified!`,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      count: pendingPayrolls.length
    });
  } catch (error) {
    console.error('[Batch Razorpay Verify Error]:', error);
    return res.status(500).json({ message: 'Failed to verify batch Razorpay payment.' });
  }
};
