const mongoose = require('mongoose');

const profileChangeRequestSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    field: { type: String, enum: ['email', 'employeeId', 'designation', 'department', 'team', 'manager', 'joiningDate'], required: true },
    currentValue: { type: String, default: '' },
    requestedValue: { type: String, required: true, trim: true },
    reason: { type: String, trim: true, maxlength: 1000, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('ProfileChangeRequest', profileChangeRequestSchema);