const mongoose = require('mongoose');

const earningItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 }
}, { _id: false });

const deductionItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  reason: { type: String, default: '' }
}, { _id: false });

const auditItemSchema = new mongoose.Schema({
  action: { type: String, required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  actorName: { type: String, default: '' },
  actorRole: { type: String, default: '' },
  remarks: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
  metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) }
}, { _id: true });

const payrollSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  team: {
    type: String,
    default: 'General'
  },
  department: {
    type: String,
    default: 'General'
  },
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  periodMonth: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  periodYear: {
    type: Number,
    required: true,
    min: 2020,
    max: 2050
  },
  periodLabel: {
    type: String,
    required: true
  },
  salaryStructureSnapshot: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({})
  },
  attendanceSnapshot: {
    totalDaysInMonth: { type: Number, default: 30 },
    workingDays: { type: Number, default: 22 },
    presentDays: { type: Number, default: 22 },
    approvedLeaves: { type: Number, default: 0 },
    unpaidLeaves: { type: Number, default: 0 },
    halfDays: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 }
  },
  earnings: {
    type: [earningItemSchema],
    default: []
  },
  deductions: {
    type: [deductionItemSchema],
    default: []
  },
  grossSalary: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  totalDeductions: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  netSalary: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  status: {
    type: String,
    enum: [
      'Calculated',
      'Pending_Manager_Review',
      'Manager_Approved',
      'Manager_Correction_Requested',
      'Admin_Approved',
      'Ready_for_Payment',
      'Processing',
      'Paid',
      'Failed',
      'Admin_Rejected'
    ],
    default: 'Calculated',
    index: true
  },
  managerReview: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'correction_requested'],
      default: 'pending'
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    remarks: { type: String, default: '' }
  },
  adminApproval: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    remarks: { type: String, default: '' }
  },
  payout: {
    payoutId: { type: String, default: null, index: true },
    provider: { type: String, default: 'RazorpayX' },
    isTestMode: { type: Boolean, default: true },
    mode: { type: String, enum: ['NEFT', 'IMPS', 'RTGS', 'UPI'], default: 'IMPS' },
    status: {
      type: String,
      enum: ['none', 'queued', 'pending', 'processing', 'processed', 'reversed', 'cancelled', 'rejected', 'failed'],
      default: 'none'
    },
    utr: { type: String, default: null },
    failureReason: { type: String, default: null },
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    initiatedAt: { type: Date, default: null },
    processedAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
    idempotencyKey: { type: String, default: null },
    safeMetadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) }
  },
  auditLog: {
    type: [auditItemSchema],
    default: []
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { timestamps: true });

// Compound unique index to prevent duplicate payroll generation for the same employee in the same period
payrollSchema.index({ employee: 1, periodMonth: 1, periodYear: 1 }, { unique: true });
payrollSchema.index({ status: 1, periodYear: 1, periodMonth: 1 });
payrollSchema.index({ manager: 1, status: 1 });

module.exports = mongoose.model('Payroll', payrollSchema);
