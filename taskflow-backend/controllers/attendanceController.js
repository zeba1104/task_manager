const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const getManagerScope = require('../managerScope');

exports.clockIn = async (req, res) => {
    try {
        const { isNextDay, newSession } = req.body || {};
        const dateStr = new Date().toISOString().split('T')[0];
        let record = await Attendance.findOne({ user: req.userId, date: dateStr });
        if (!record) {
            record = await Attendance.create({ user: req.userId, date: dateStr, clockIn: new Date() });
        } else if (!record.clockIn) {
            record.clockIn = new Date();
            await record.save();
        } else if (record.clockOut && (isNextDay || newSession)) {
            // User clocks in for next day or a new session: register new clockIn and reset clockOut
            record.clockIn = new Date();
            record.clockOut = null;
            await record.save();
        }
        res.json(record);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.clockOut = async (req, res) => {
    try {
        const { seconds = 0 } = req.body || {};
        const dateStr = new Date().toISOString().split('T')[0];
        let record = await Attendance.findOne({ user: req.userId, date: dateStr });
        
        const now = new Date();
        let elapsed = 0;
        if (record?.clockIn) {
            elapsed = Math.max(0, Math.round((now.getTime() - new Date(record.clockIn).getTime()) / 1000));
        }
        const effectiveSeconds = Math.max(Number(seconds) || 0, elapsed);

        if (!record) {
            record = await Attendance.create({ user: req.userId, date: dateStr, clockOut: now, totalSeconds: effectiveSeconds });
        } else {
            record.clockOut = now;
            record.totalSeconds = Math.max(record.totalSeconds || 0, effectiveSeconds);
            await record.save();
        }
        res.json(record);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const mergeApprovedLeaves = (records, leaves) => {
    const map = new Map();
    const now = new Date();

    records.forEach((record) => {
        let total = record.totalSeconds || 0;
        const isActive = Boolean(record.clockIn && !record.clockOut);
        if (record.clockIn) {
            if (record.clockOut) {
                const elapsed = Math.max(0, Math.round((new Date(record.clockOut).getTime() - new Date(record.clockIn).getTime()) / 1000));
                total = Math.max(total, elapsed);
            } else {
                const elapsed = Math.max(0, Math.round((now.getTime() - new Date(record.clockIn).getTime()) / 1000));
                total = Math.max(total, elapsed);
            }
        }
        const key = `${String(record.user?._id || record.user)}_${record.date}`;
        map.set(key, {
            ...record,
            totalSeconds: total,
            isActive
        });
    });

    leaves.forEach((leave) => {
        if (!leave.startDate || !leave.endDate) return;
        const cur = new Date(leave.startDate);
        cur.setHours(0, 0, 0, 0);
        const endDay = new Date(leave.endDate);
        endDay.setHours(0, 0, 0, 0);

        const userIdStr = String(leave.user?._id || leave.user);

        let safetyCount = 0;
        while (cur <= endDay && safetyCount < 366) {
            safetyCount++;
            const year = cur.getFullYear();
            const month = String(cur.getMonth() + 1).padStart(2, '0');
            const day = String(cur.getDate()).padStart(2, '0');
            const dateKey = `${year}-${month}-${day}`;
            const key = `${userIdStr}_${dateKey}`;

            const existing = map.get(key);
            if (!existing) {
                map.set(key, {
                    _id: `leave_${leave._id}_${dateKey}`,
                    user: leave.user,
                    date: dateKey,
                    clockIn: null,
                    clockOut: null,
                    totalSeconds: 0,
                    status: 'on-leave',
                    isOnLeave: true,
                    leaveDetails: {
                        _id: leave._id,
                        leaveType: leave.leaveType,
                        reason: leave.reason,
                        totalDays: leave.totalDays,
                    }
                });
            } else if (!existing.clockIn || existing.status === 'on-leave') {
                existing.status = 'on-leave';
                existing.isOnLeave = true;
                existing.leaveDetails = {
                    _id: leave._id,
                    leaveType: leave.leaveType,
                    reason: leave.reason,
                    totalDays: leave.totalDays,
                };
            }
            cur.setDate(cur.getDate() + 1);
        }
    });

    return Array.from(map.values()).sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
};

exports.getAttendance = async (req, res) => {
    try {
        let filter = {};
        let leaveFilter = { status: 'approved' };
        if (req.query.mine === 'true' || req.userRole === 'Employee') {
            filter.user = req.userId;
            leaveFilter.user = req.userId;
        } else if (req.userRole === 'Manager') {
            const scope = await getManagerScope(req.userId);
            const userIds = scope?.memberIds || [req.userId];
            filter.user = { $in: userIds };
            leaveFilter.user = { $in: userIds };
        }

        const [records, leaves] = await Promise.all([
            Attendance.find(filter)
                .populate('user', 'name email department employeeId designation role profilePicture')
                .sort({ date: -1 })
                .lean(),
            LeaveRequest.find(leaveFilter)
                .populate('user', 'name email department employeeId designation role profilePicture')
                .lean()
        ]);

        const combined = mergeApprovedLeaves(records, leaves);
        res.json(combined);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getMyAttendance = async (req, res) => {
    try {
        const [records, leaves] = await Promise.all([
            Attendance.find({ user: req.userId })
                .populate('user', 'name email department employeeId designation role profilePicture')
                .sort({ date: -1 })
                .lean(),
            LeaveRequest.find({ user: req.userId, status: 'approved' })
                .populate('user', 'name email department employeeId designation role profilePicture')
                .lean()
        ]);

        const combined = mergeApprovedLeaves(records, leaves);
        res.json(combined);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
