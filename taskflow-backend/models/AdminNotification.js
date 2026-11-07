const mongoose = require('mongoose');

const adminNotificationSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    type: { 
        type: String, 
        enum: ['project_update', 'transfer_request', 'profile_change', 'general'], 
        default: 'project_update' 
    },
    priority: { 
        type: String, 
        enum: ['Low', 'Medium', 'High', 'Critical'], 
        default: 'Medium' 
    },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isRead: { type: Boolean, default: false },
}, { timestamps: true });

adminNotificationSchema.index({ isRead: 1, createdAt: -1 });

module.exports = mongoose.model('AdminNotification', adminNotificationSchema);
