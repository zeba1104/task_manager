const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema(
  {
    initiator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    initiatorRole: {
      type: String,
      enum: ['Employee', 'Manager'],
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipientRole: {
      type: String,
      enum: ['Manager', 'Admin'],
      required: true,
    },
    type: {
      type: String,
      enum: ['EMPLOYEE_MANAGER', 'MANAGER_ADMIN'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'closed'],
      default: 'pending',
      index: true,
    },
    subject: {
      type: String,
      trim: true,
      default: 'General Communication',
      maxlength: 200,
    },
    requestNote: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    lastMessage: {
      type: String,
      default: '',
      maxlength: 4000,
    },
    lastMessageSender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    unreadByInitiator: {
      type: Number,
      default: 0,
    },
    unreadByRecipient: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

chatSessionSchema.index({ initiator: 1, recipient: 1, status: 1 });

module.exports = mongoose.model('ChatSession', chatSessionSchema);
