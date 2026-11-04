const mongoose = require('mongoose');

const focusSessionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    task: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true
    },
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date
    },
    durationSeconds: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('FocusSession', focusSessionSchema);
