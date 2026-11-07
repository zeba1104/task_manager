const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    deliverables: { type: String, trim: true, default: '' },
    dueDate: { type: Date, default: null },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
}, { timestamps: true });

const documentSchema = new mongoose.Schema({
    originalName: { type: String, required: true },
    fileName: { type: String, required: true },
    contentType: { type: String, default: 'application/octet-stream' },
    size: { type: Number, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
});

const commentSchema = new mongoose.Schema({
    text: { type: String, required: true, trim: true, maxlength: 3000 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
});

const projectSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true, default: '' },
    objectives: { type: String, trim: true, default: '' },
    requirements: { type: String, trim: true, default: '' },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    teamLead: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedEmployees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    priority: { 
        type: String, 
        enum: ['Low', 'Medium', 'High', 'Critical', 'low', 'medium', 'high', 'critical'], 
        default: 'Medium' 
    },
    status: { 
        type: String, 
        enum: ['Planning', 'In Progress', 'On Hold', 'Completed', 'active', 'paused', 'completed'], 
        default: 'Planning' 
    },
    startDate: { type: Date, default: Date.now },
    deadline: { type: Date, default: null },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    milestones: [milestoneSchema],
    documents: [documentSchema],
    comments: [commentSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
