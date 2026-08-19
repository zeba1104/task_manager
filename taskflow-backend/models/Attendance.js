const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: String, // YYYY-MM-DD
        required: true
    },
    clockIn: {
        type: Date,
        default: null
    },
    clockOut: {
        type: Date,
        default: null
    },
    totalSeconds: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
