const Attendance = require('../models/Attendance');

exports.clockIn = async (req, res) => {
    try {
        const dateStr = new Date().toISOString().split('T')[0];
        let record = await Attendance.findOne({ user: req.userId, date: dateStr });
        if (!record) {
            record = await Attendance.create({ user: req.userId, date: dateStr, clockIn: new Date() });
        } else if (!record.clockIn) {
            record.clockIn = new Date();
            await record.save();
        }
        res.json(record);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.clockOut = async (req, res) => {
    try {
        const { seconds } = req.body;
        const dateStr = new Date().toISOString().split('T')[0];
        let record = await Attendance.findOne({ user: req.userId, date: dateStr });
        
        if (!record) {
            record = await Attendance.create({ user: req.userId, date: dateStr, clockOut: new Date(), totalSeconds: seconds });
        } else {
            record.clockOut = new Date();
            record.totalSeconds = (record.totalSeconds || 0) + seconds;
            await record.save();
        }
        res.json(record);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getAttendance = async (req, res) => {
    try {
        // Only Admin or Manager can view all
        if (req.userRole === 'Employee') return res.status(403).json({ message: 'Denied' });
        
        const records = await Attendance.find().populate('user', 'name department manager').sort({ date: -1 });
        res.json(records);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
