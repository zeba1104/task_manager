const mongoose = require('mongoose');

const transferRequestSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    currentDepartment: { type: String, trim: true, default: '' },
    currentTeam: { type: String, trim: true, default: '' },
    targetDepartment: { type: String, required: true, trim: true },
    targetTeam: { type: String, trim: true, default: '' },
    targetManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, required: true, trim: true, maxlength: 2000 },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    adminNotes: { type: String, trim: true, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
}, { timestamps: true });

transferRequestSchema.index({ employee: 1 });
transferRequestSchema.index({ requestedBy: 1 });
transferRequestSchema.index({ status: 1 });

module.exports = mongoose.model('TransferRequest', transferRequestSchema);
