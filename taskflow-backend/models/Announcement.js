const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, maxlength: 160 },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    audience: { type: String, enum: ['all', 'department'], default: 'all' },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    publishedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);