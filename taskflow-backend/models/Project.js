const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true, default: '' },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    startDate: { type: Date, default: Date.now },
    deadline: { type: Date, default: null },
    status: { type: String, enum: ['active', 'paused', 'completed'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);