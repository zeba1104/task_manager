const mongoose = require('mongoose');

const subtaskSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    completed: { type: Boolean, default: false },
});

const commentSchema = new mongoose.Schema({
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

const attachmentSchema = new mongoose.Schema({
    originalName: { type: String, required: true },
    fileName: { type: String, required: true },
    contentType: { type: String, default: 'application/octet-stream' },
    size: { type: Number, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
});

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        default: '',
    },
    status: {
        type: String,
        enum: ['pending', 'in-process', 'in-review', 'completed'],
        default: 'pending',
    },
    priority: {
        type: String,
        enum: ['critical', 'high', 'medium', 'low'],
        default: 'medium',
    },
    category: {
        type: String,
        default: 'general',
    },
    project: {
        type: String,
        trim: true,
        default: '',
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    deadline: {
        type: Date,
        default: null
    },
    estimatedMinutes: {
        type: Number,
        min: 0,
        default: 60,
    },
    subtasks: [subtaskSchema],
    comments: [commentSchema],
    attachments: [attachmentSchema],
}, { timestamps: true });

module.exports = mongoose.model('Task',taskSchema);