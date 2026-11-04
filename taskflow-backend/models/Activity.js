const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, required: true, trim: true },
    targetType: { type: String, required: true, trim: true },
    targetName: { type: String, required: true, trim: true },
    details: { type: String, trim: true, default: '' },
}, { timestamps: true });

activitySchema.index({ createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);