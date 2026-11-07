const mongoose = require('mongoose');

const leaveHistorySchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ['SUBMITTED', 'ROUTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'OVERRIDDEN'],
    required: true,
  },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  actorRole: { type: String, default: '' },
  actorName: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
  note: { type: String, default: '' },
}, { _id: true });

const leaveRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  requesterRole: {
    type: String,
    enum: ['Employee', 'Manager', 'Admin'],
    default: 'Employee',
  },
  leaveType: {
    type: String,
    enum: ['annual', 'sick', 'casual', 'maternity_paternity', 'personal', 'other'],
    default: 'annual',
  },
  startDate: { type: Date, required: true, index: true },
  endDate: { type: Date, required: true, index: true },
  totalDays: { type: Number, default: 1, min: 0.5 },
  reason: { type: String, trim: true, maxlength: 2000, default: '' },
  supportingDocument: {
    originalName: { type: String, default: '' },
    filename: { type: String, default: '' },
    path: { type: String, default: '' },
    size: { type: Number, default: 0 },
    mimetype: { type: String, default: '' },
  },
  assignedManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  approver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  approverRole: { type: String, enum: ['Manager', 'Admin', null], default: null },
  approvalRoute: {
    type: String,
    enum: ['MANAGER', 'ADMIN'],
    required: true,
    default: 'ADMIN',
  },
  routingReason: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending',
    index: true,
  },
  rejectionReason: { type: String, default: '' },
  submittedAt: { type: Date, default: Date.now },
  approvedAt: { type: Date, default: null },
  rejectedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  approvalHistory: { type: [leaveHistorySchema], default: [] },

  // Backward compatibility fields
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
}, { timestamps: true });

leaveRequestSchema.index({ user: 1, status: 1 });
leaveRequestSchema.index({ startDate: 1, endDate: 1, status: 1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
