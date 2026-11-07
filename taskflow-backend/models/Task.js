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

const managerFeedbackSchema = new mongoose.Schema({
    text: { type: String, required: true, trim: true },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requestedChanges: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});

const progressUpdateSchema = new mongoose.Schema({
    text: { type: String, required: true, trim: true },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    createdAt: { type: Date, default: Date.now },
});

const taskHistorySchema = new mongoose.Schema({
    action: { type: String, required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    details: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
});

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        default: '',
    },
    instructions: {
        type: String,
        trim: true,
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
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    startDate: {
        type: Date,
        default: Date.now,
    },
    deadline: {
        type: Date,
        default: null,
    },
    estimatedMinutes: {
        type: Number,
        min: 0,
        default: 60,
    },
    reviewStatus: {
        type: String,
        enum: ['none', 'submitted', 'changes-requested', 'approved'],
        default: 'none',
    },
    submissionNotes: {
        type: String,
        trim: true,
        default: '',
    },
    submittedAt: {
        type: Date,
        default: null,
    },
    subtasks: [subtaskSchema],
    comments: [commentSchema],
    attachments: [attachmentSchema],
    managerFeedback: [managerFeedbackSchema],
    progressUpdates: [progressUpdateSchema],
    history: [taskHistorySchema],
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
