const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const Holiday = require('../models/Holiday');
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

const mergeApprovedLeavesAndAbsences = (records, leaves, usersToTrack = [], queryMonth = null, queryDate = null, holidayDates = new Set()) => {
    const map = new Map();
    const now = new Date();

    // 1. Populate actual clock-in records
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
        const userId = String(record.user?._id || record.user);
        const key = `${userId}_${record.date}`;
        map.set(key, {
            ...record,
            totalSeconds: total,
            isActive
        });
    });

    // 2. Merge approved leave requests
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

    // 3. Mark ABSENT for every working day (Monday - Friday) where user did not clock in and has no approved leave
    // EXCLUDES Saturday (day 6) and Sunday (day 0) completely!
    if (usersToTrack && usersToTrack.length > 0) {
        let rangeStart;
        let rangeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (queryDate) {
            rangeStart = new Date(queryDate + 'T00:00:00');
            rangeEnd = new Date(queryDate + 'T00:00:00');
        } else if (queryMonth) {
            const [y, m] = queryMonth.split('-').map(Number);
            rangeStart = new Date(y, m - 1, 1);
            const lastDay = new Date(y, m, 0);
            if (lastDay < rangeEnd) {
                rangeEnd = lastDay;
            }
        } else {
            // Default: from first day of previous month up to today
            rangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        }

        usersToTrack.forEach((user) => {
            const userCreated = user.createdAt ? new Date(user.createdAt) : null;
            const userCreatedStr = userCreated ? userCreated.toISOString().split('T')[0] : null;
            const userIdStr = String(user._id || user);

            const cur = new Date(rangeStart);
            cur.setHours(0, 0, 0, 0);
            const end = new Date(rangeEnd);
            end.setHours(0, 0, 0, 0);

            let safety = 0;
            while (cur <= end && safety < 400) {
                safety++;
                const dayOfWeek = cur.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
                const year = cur.getFullYear();
                const month = String(cur.getMonth() + 1).padStart(2, '0');
                const day = String(cur.getDate()).padStart(2, '0');
                const dateKey = `${year}-${month}-${day}`;

                // Skip Saturday (6), Sunday (0), and official public holidays
                if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateKey)) {
                    // Do not mark absent before user's account creation date
                    if (!userCreatedStr || dateKey >= userCreatedStr) {
                        const key = `${userIdStr}_${dateKey}`;
                        const existing = map.get(key);

                        if (!existing) {
                            map.set(key, {
                                _id: `absent_${userIdStr}_${dateKey}`,
                                user: {
                                    _id: user._id,
                                    name: user.name,
                                    email: user.email,
                                    department: user.department || 'General',
                                    employeeId: user.employeeId || '',
                                    role: user.role || 'Employee',
                                    designation: user.designation || '',
                                    profilePicture: user.profilePicture || ''
                                },
                                date: dateKey,
                                clockIn: null,
                                clockOut: null,
                                totalSeconds: 0,
                                status: 'absent',
                                isAbsent: true
                            });
                        } else if (!existing.clockIn && !existing.isOnLeave && existing.status !== 'on-leave') {
                            existing.status = 'absent';
                            existing.isAbsent = true;
                        }
                    }
                }

                cur.setDate(cur.getDate() + 1);
            }
        });
    }

    return Array.from(map.values()).sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
};

exports.getAttendance = async (req, res) => {
    try {
        let filter = {};
        let leaveFilter = { status: 'approved' };
        let usersToTrack = [];

        if (req.query.mine === 'true' || req.userRole === 'Employee') {
            filter.user = req.userId;
            leaveFilter.user = req.userId;
            usersToTrack = await User.find({ _id: req.userId }, 'name email department employeeId designation role profilePicture createdAt').lean();
        } else if (req.userRole === 'Manager') {
            const scope = await getManagerScope(req.userId);
            const userIds = scope?.memberIds || [req.userId];
            filter.user = { $in: userIds };
            leaveFilter.user = { $in: userIds };
            usersToTrack = await User.find({ _id: { $in: userIds }, role: { $in: ['Employee', 'Manager'] } }, 'name email department employeeId designation role profilePicture createdAt').lean();
        } else {
            // Admin: track all employees and managers
            usersToTrack = await User.find({ role: { $in: ['Employee', 'Manager'] } }, 'name email department employeeId designation role profilePicture createdAt').lean();
        }

        const [records, leaves, holidays] = await Promise.all([
            Attendance.find(filter)
                .populate('user', 'name email department employeeId designation role profilePicture')
                .sort({ date: -1 })
                .lean(),
            LeaveRequest.find(leaveFilter)
                .populate('user', 'name email department employeeId designation role profilePicture')
                .lean(),
            Holiday.find({}, 'date').lean(),
        ]);

        const holidayDates = new Set(holidays.map((h) => h.date));
        const combined = mergeApprovedLeavesAndAbsences(records, leaves, usersToTrack, req.query.month, req.query.date, holidayDates);
        res.json(combined);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getMyAttendance = async (req, res) => {
    try {
        const [records, leaves, usersToTrack, holidays] = await Promise.all([
            Attendance.find({ user: req.userId })
                .populate('user', 'name email department employeeId designation role profilePicture')
                .sort({ date: -1 })
                .lean(),
            LeaveRequest.find({ user: req.userId, status: 'approved' })
                .populate('user', 'name email department employeeId designation role profilePicture')
                .lean(),
            User.find({ _id: req.userId }, 'name email department employeeId designation role profilePicture createdAt').lean(),
            Holiday.find({}, 'date').lean(),
        ]);

        const holidayDates = new Set(holidays.map((h) => h.date));
        const combined = mergeApprovedLeavesAndAbsences(records, leaves, usersToTrack, req.query.month, req.query.date, holidayDates);
        res.json(combined);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
