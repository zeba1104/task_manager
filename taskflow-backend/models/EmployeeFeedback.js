const mongoose = require('mongoose');

const employeeFeedbackSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    feedbackType: { 
        type: String, 
        enum: ['Performance', 'Praise', 'Improvement', 'General'], 
        default: 'General' 
    },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    comments: { type: String, required: true, trim: true, maxlength: 3000 },
}, { timestamps: true });

employeeFeedbackSchema.index({ employee: 1, createdAt: -1 });
employeeFeedbackSchema.index({ manager: 1, createdAt: -1 });

module.exports = mongoose.model('EmployeeFeedback', employeeFeedbackSchema);
