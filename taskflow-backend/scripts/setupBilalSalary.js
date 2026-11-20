const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

const User = require('../models/User');
const SalaryStructure = require('../models/SalaryStructure');
const Payroll = require('../models/Payroll');

async function setup() {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'taskflow' });
  console.log('Connected to MongoDB taskflow database');

  // Find Admin and Manager
  const admin = await User.findOne({ role: 'Admin' });
  const manager = await User.findOne({ role: 'Manager' });

  // 1. Create or update user: Mr. Bilal Ahmad (NT-0142)
  let bilal = await User.findOne({
    $or: [{ employeeId: 'NT-0142' }, { email: 'bilal.ahmad@taskflow.local' }]
  });

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('Employee@123', salt);

  if (!bilal) {
    bilal = new User({
      name: 'Mr. Bilal Ahmad',
      firstName: 'Bilal',
      lastName: 'Ahmad',
      email: 'bilal.ahmad@taskflow.local',
      employeeId: 'NT-0142',
      password: hashedPassword,
      role: 'Employee',
      department: 'Operations',
      designation: 'Production Supervisor',
      employmentType: 'Full-time',
      employmentStatus: 'Active',
      joiningDate: new Date('2022-03-03'),
      manager: manager ? manager._id : (admin ? admin._id : null),
      team: 'Operations',
      phone: '+91 98765 43210'
    });
    await bilal.save();
    console.log('Created user Bilal Ahmad:', bilal._id);
  } else {
    bilal.name = 'Mr. Bilal Ahmad';
    bilal.firstName = 'Bilal';
    bilal.lastName = 'Ahmad';
    bilal.employeeId = 'NT-0142';
    bilal.department = 'Operations';
    bilal.designation = 'Production Supervisor';
    bilal.joiningDate = new Date('2022-03-03');
    if (manager) bilal.manager = manager._id;
    bilal.team = 'Operations';
    await bilal.save();
    console.log('Updated user Bilal Ahmad:', bilal._id);
  }

  // 2. Configure Salary Structure according to the document:
  // Basic: 60,000
  // House rent allowance: 24,000
  // Transport & medical allowance: 10,000
  // Gross: 94,000
  // Statutory deductions: 11,350
  // Net: 82,650
  let structure = await SalaryStructure.findOne({ employee: bilal._id });
  if (!structure) {
    structure = new SalaryStructure({ employee: bilal._id });
  }

  structure.basicSalary = 60000;
  structure.allowances = [
    { name: 'House Rent Allowance (HRA)', amount: 24000 },
    { name: 'Transport & Medical Allowance', amount: 10000 }
  ];
  structure.bonus = 0;
  structure.deductions = [
    { name: 'Statutory Deductions', amount: 11350, type: 'fixed' }
  ];
  structure.bankDetails = {
    accountHolderName: 'Bilal Ahmad',
    accountNumber: '112233440142',
    ifsc: 'HDFC0001234',
    bankName: 'HDFC Bank',
    upiId: 'bilal.ahmad@okhdfcbank'
  };
  structure.effectiveFrom = new Date('2022-03-03');
  structure.isActive = true;
  await structure.save();
  console.log('Saved SalaryStructure for Bilal Ahmad');

  // 3. Create / Upsert November 2026 Payroll (Ready for Payment payout)
  let novPayroll = await Payroll.findOne({
    employee: bilal._id,
    periodMonth: 11,
    periodYear: 2026
  });

  if (!novPayroll) {
    novPayroll = new Payroll({
      employee: bilal._id,
      periodMonth: 11,
      periodYear: 2026,
      periodLabel: 'November 2026',
      team: 'Operations',
      department: 'Operations',
      manager: manager ? manager._id : null
    });
  }

  novPayroll.salaryStructureSnapshot = {
    basicSalary: 60000,
    allowances: [
      { name: 'House Rent Allowance (HRA)', amount: 24000 },
      { name: 'Transport & Medical Allowance', amount: 10000 }
    ],
    bonus: 0,
    deductions: [
      { name: 'Statutory Deductions', amount: 11350, type: 'fixed' }
    ],
    bankDetails: structure.bankDetails
  };

  novPayroll.attendanceSnapshot = {
    totalDaysInMonth: 30,
    workingDays: 22,
    presentDays: 22,
    approvedLeaves: 0,
    unpaidLeaves: 0,
    halfDays: 0,
    absentDays: 0,
    overtimeHours: 0
  };

  novPayroll.earnings = [
    { name: 'Basic salary', amount: 60000 },
    { name: 'House rent allowance', amount: 24000 },
    { name: 'Transport & medical allowance', amount: 10000 }
  ];

  novPayroll.deductions = [
    { name: 'Statutory deductions', amount: 11350, reason: 'Statutory taxes & PF contribution' }
  ];

  novPayroll.grossSalary = 94000;
  novPayroll.totalDeductions = 11350;
  novPayroll.netSalary = 82650;
  novPayroll.status = 'Ready_for_Payment';

  novPayroll.managerReview = {
    status: 'approved',
    reviewedBy: manager ? manager._id : null,
    reviewedAt: new Date('2026-11-18T10:00:00Z'),
    remarks: 'Full 100% attendance verified in Operations Department.'
  };

  novPayroll.adminApproval = {
    status: 'approved',
    approvedBy: admin ? admin._id : null,
    approvedAt: new Date('2026-11-19T11:00:00Z'),
    remarks: 'Approved for Razorpay disbursement as per official salary certificate (Net ₹82,650).'
  };

  novPayroll.payout = {
    provider: 'Razorpay Test Gateway',
    isTestMode: true,
    mode: 'IMPS',
    status: 'none',
    payoutId: null,
    utr: null,
    attempts: 0
  };

  novPayroll.auditLog = [
    {
      action: 'Payroll Generated',
      actor: admin ? admin._id : null,
      actorName: 'Administrator',
      actorRole: 'Admin',
      remarks: 'Calculated monthly remuneration: Gross ₹94,000, Deductions ₹11,350, Net ₹82,650',
      timestamp: new Date('2026-11-18T09:00:00Z')
    },
    {
      action: 'Manager Approval',
      actor: manager ? manager._id : null,
      actorName: manager ? manager.name : 'Manager',
      actorRole: 'Manager',
      remarks: 'Full attendance verified',
      timestamp: new Date('2026-11-18T10:00:00Z')
    },
    {
      action: 'Admin Final Approval',
      actor: admin ? admin._id : null,
      actorName: 'Administrator',
      actorRole: 'Admin',
      remarks: 'Approved for disbursement',
      timestamp: new Date('2026-11-19T11:00:00Z')
    }
  ];

  await novPayroll.save();
  console.log('Saved November 2026 Payroll for Bilal Ahmad (Ready_for_Payment, ₹82,650)');

  // 4. Create September 2026 Payroll (Matching the Certificate Date: 8 September 2026)
  let septPayroll = await Payroll.findOne({
    employee: bilal._id,
    periodMonth: 9,
    periodYear: 2026
  });

  if (!septPayroll) {
    septPayroll = new Payroll({
      employee: bilal._id,
      periodMonth: 9,
      periodYear: 2026,
      periodLabel: 'September 2026',
      team: 'Operations',
      department: 'Operations',
      manager: manager ? manager._id : null
    });
  }

  septPayroll.salaryStructureSnapshot = novPayroll.salaryStructureSnapshot;
  septPayroll.attendanceSnapshot = novPayroll.attendanceSnapshot;
  septPayroll.earnings = novPayroll.earnings;
  septPayroll.deductions = novPayroll.deductions;
  septPayroll.grossSalary = 94000;
  septPayroll.totalDeductions = 11350;
  septPayroll.netSalary = 82650;
  septPayroll.status = 'Paid';

  septPayroll.managerReview = {
    status: 'approved',
    reviewedBy: manager ? manager._id : null,
    reviewedAt: new Date('2026-09-06T10:00:00Z'),
    remarks: 'Verified'
  };

  septPayroll.adminApproval = {
    status: 'approved',
    approvedBy: admin ? admin._id : null,
    approvedAt: new Date('2026-09-07T11:00:00Z'),
    remarks: 'Approved'
  };

  septPayroll.payout = {
    provider: 'Razorpay Test Gateway',
    isTestMode: true,
    mode: 'IMPS',
    status: 'processed',
    payoutId: 'pay_test_NT0142_SEPT',
    utr: 'RZP0142SEPT26',
    processedAt: new Date('2026-09-08T10:30:00Z'),
    initiatedBy: admin ? admin._id : null,
    initiatedAt: new Date('2026-09-08T10:29:00Z'),
    attempts: 1,
    safeMetadata: {
      provider: 'Razorpay Test Mode',
      contactName: 'Mr. Bilal Ahmad',
      accountMasked: '••••0142',
      ifsc: 'HDFC0001234',
      certificateRef: 'HR/SC/2026/0184'
    }
  };

  septPayroll.auditLog = [
    {
      action: 'Razorpay Payment Completed',
      actor: admin ? admin._id : null,
      actorName: 'Administrator',
      actorRole: 'Admin',
      remarks: 'Paid via Razorpay Test Checkout. UTR: RZP0142SEPT26',
      timestamp: new Date('2026-09-08T10:30:00Z')
    }
  ];

  await septPayroll.save();
  console.log('Saved September 2026 Payroll for Bilal Ahmad (Paid, ₹82,650, UTR: RZP0142SEPT26)');

  // 5. Also create notification for Admin
  const AdminNotification = require('../models/AdminNotification');
  await AdminNotification.create({
    title: 'Salary Ready for Disbursement',
    message: `Salary for Mr. Bilal Ahmad (November 2026, ₹82,650) is approved and waiting for Razorpay payout.`,
    type: 'general',
    priority: 'High',
    sender: manager ? manager._id : admin._id,
    employee: bilal._id,
    isRead: false
  });

  console.log('Setup successfully completed!');
  process.exit(0);
}

setup().catch((err) => {
  console.error('Setup error:', err);
  process.exit(1);
});
