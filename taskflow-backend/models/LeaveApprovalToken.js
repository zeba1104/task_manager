const mongoose = require('mongoose');

const leaveApprovalTokenSchema = new mongoose.Schema({
  leaveRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LeaveRequest',
    required: true,
    index: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  action: {
    type: String,
    enum: ['approve', 'reject'],
    required: true,
  },
  approver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  approverRole: {
    type: String,
    enum: ['Manager', 'Admin'],
    required: true,
  },
  isUsed: {
    type: Boolean,
    default: false,
    index: true,
  },
  usedAt: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('LeaveApprovalToken', leaveApprovalTokenSchema);
