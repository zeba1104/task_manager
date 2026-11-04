const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    leaveType: { type: String, enum: ['annual', 'sick', 'personal', 'other'], default: 'annual' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, trim: true, maxlength: 1000, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);