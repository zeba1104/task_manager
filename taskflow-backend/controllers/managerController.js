const User = require('../models/User');
const Task = require('../models/Task');
const Project = require('../models/Project');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const Announcement = require('../models/Announcement');
const Activity = require('../models/Activity');
const ProfileChangeRequest = require('../models/ProfileChangeRequest');
const bcrypt = require('bcrypt');
const logActivity = require('../activityLogger');
const getManagerScope = require('../managerScope');

exports.getProfile = async (req, res) => {
    if (req.userRole !== 'Manager') return res.status(403).json({ message: 'Manager access required' });
    try {
        const scope = await getManagerScope(req.userId);
        if (!scope) return res.status(403).json({ message: 'Manager account is not active' });
        const [manager, requests] = await Promise.all([
            User.findById(req.userId).select('-password').populate('manager', 'name email role').lean(),
            ProfileChangeRequest.find({ user: req.userId }).sort({ createdAt: -1 }).limit(20).lean(),
        ]);
        return res.json({
            manager,
            department: scope.department,
            teams: [...new Set(scope.employees.map((employee) => String(employee.team || '').trim()).filter(Boolean))],
            departmentHead: scope.department?.head || null,
            reportingAuthority: manager?.manager || null,
            changeRequests: requests,
        });
    } catch (error) {
        return res.status(500).json({ message: 'Could not load manager profile' });
    }
};

exports.updateProfile = async (req, res) => {
    if (req.userRole !== 'Manager') return res.status(403).json({ message: 'Manager access required' });
    const updates = {};
    if (req.body.phone !== undefined) updates.phone = String(req.body.phone).trim();
    if (req.body.firstName !== undefined) updates.firstName = String(req.body.firstName).trim();
    if (req.body.lastName !== undefined) updates.lastName = String(req.body.lastName).trim();
    if (updates.firstName !== undefined || updates.lastName !== undefined) {
        const current = await User.findById(req.userId).select('firstName lastName name');
        if (!current) return res.status(404).json({ message: 'Manager not found' });
        updates.name = [updates.firstName ?? current.firstName, updates.lastName ?? current.lastName].filter(Boolean).join(' ').trim() || current.name;
    }
    const manager = await User.findByIdAndUpdate(req.userId, updates, { new: true, runValidators: true }).select('-password');
    return res.json(manager);
};

exports.changePassword = async (req, res) => {
    if (req.userRole !== 'Manager') return res.status(403).json({ message: 'Manager access required' });
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || String(newPassword).length < 8) {
        return res.status(400).json({ message: 'Current password and a new password of at least 8 characters are required' });
    }
    const manager = await User.findById(req.userId);
    if (!manager || !await bcrypt.compare(currentPassword, manager.password)) {
        return res.status(400).json({ message: 'Current password is incorrect' });
    }
    manager.password = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
    await manager.save();
    return res.json({ message: 'Password changed successfully' });
};

exports.createProfileChangeRequest = async (req, res) => {
    if (req.userRole !== 'Manager') return res.status(403).json({ message: 'Manager access required' });
    const allowedFields = ['email', 'employeeId', 'designation', 'department', 'team', 'manager', 'joiningDate'];
    const { field, requestedValue, reason } = req.body;
    if (!allowedFields.includes(field) || !String(requestedValue || '').trim()) {
        return res.status(400).json({ message: 'Choose a restricted field and enter the requested value' });
    }
    try {
        const manager = await User.findById(req.userId).select(field);
        if (!manager) return res.status(404).json({ message: 'Manager not found' });
        const pending = await ProfileChangeRequest.findOne({ user: req.userId, field, status: 'pending' });
        if (pending) return res.status(409).json({ message: 'A request for this field is already pending' });
        const request = await ProfileChangeRequest.create({
            user: req.userId,
            field,
            currentValue: manager[field] == null ? '' : String(manager[field]),
            requestedValue: String(requestedValue).trim(),
            reason: reason || '',
        });
        logActivity(req.userId, 'requested profile change', 'profile change request', field);
        return res.status(201).json(request);
    } catch (error) {
        return res.status(500).json({ message: 'Could not submit profile change request' });
    }
};

exports.getOverview = async (req, res) => {
    if (req.userRole !== 'Manager') return res.status(403).json({ message: 'Manager access required' });
    try {
        const scope = await getManagerScope(req.userId);
        if (!scope) return res.status(403).json({ message: 'Manager account is not active' });
        const now = new Date();
        const todayKey = now.toISOString().slice(0, 10);
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);
        const projectFilter = scope.isDepartmentHead && scope.department
            ? { $or: [{ manager: req.userId }, { department: scope.department._id }] }
            : { manager: req.userId };
        const projects = await Project.find(projectFilter).populate('department', 'name code').sort({ deadline: 1 }).lean();
        const projectNames = projects.map((project) => project.name);
        const taskFilter = { $or: [{ user: { $in: scope.memberIds } }] };
        if (projectNames.length) taskFilter.$or.push({ project: { $in: projectNames } });

        const [tasks, attendance, onLeave, pendingLeave, announcements, activities] = await Promise.all([
            Task.find(taskFilter).populate('user', 'name department team').sort({ deadline: 1, updatedAt: -1 }).lean(),
            Attendance.find({ user: { $in: scope.employees.map((employee) => employee._id) }, date: todayKey }).select('user clockIn').lean(),
            LeaveRequest.find({ user: { $in: scope.employees.map((employee) => employee._id) }, status: 'approved', startDate: { $lte: todayEnd }, endDate: { $gte: todayStart } }).select('user').lean(),
            LeaveRequest.find({ user: { $in: scope.employees.map((employee) => employee._id) }, status: 'pending' }).populate('user', 'name email department team').sort({ createdAt: 1 }).limit(20).lean(),
            Announcement.find({ $or: [{ audience: 'all' }, ...(scope.department ? [{ audience: 'department', department: scope.department._id }] : [])] }).populate('publishedBy', 'name').sort({ publishedAt: -1 }).limit(10).lean(),
            Activity.find({ actor: { $in: scope.memberIds } }).populate('actor', 'name role').sort({ createdAt: -1 }).limit(12).lean(),
        ]);

        const attendanceByUser = new Map(attendance.map((record) => [String(record.user), record]));
        const leaveIds = new Set(onLeave.map((request) => String(request.user)));
        const attendanceSummary = { present: 0, absent: 0, late: 0, onLeave: 0 };
        scope.employees.forEach((employee) => {
            const id = String(employee._id);
            if (leaveIds.has(id)) {
                attendanceSummary.onLeave++;
                return;
            }
            const clockIn = attendanceByUser.get(id)?.clockIn;
            if (!clockIn) attendanceSummary.absent++;
            else if (new Date(clockIn).getHours() >= 9) attendanceSummary.late++;
            else attendanceSummary.present++;
        });

        const projectProgress = projects.map((project) => {
            const projectTasks = tasks.filter((task) => String(task.project || '').toLowerCase() === project.name.toLowerCase());
            const completedTasks = projectTasks.filter((task) => task.status === 'completed').length;
            return {
                ...project,
                taskCount: projectTasks.length,
                completedTasks,
                progress: projectTasks.length ? Math.round((completedTasks / projectTasks.length) * 100) : (project.status === 'completed' ? 100 : 0),
            };
        });
        const employeeTaskStats = scope.employees.map((employee) => {
            const employeeTasks = tasks.filter((task) => String(task.user?._id || task.user) === String(employee._id));
            const completedTasks = employeeTasks.filter((task) => task.status === 'completed').length;
            return {
                id: employee._id,
                name: employee.name,
                department: employee.department,
                team: employee.team,
                taskCount: employeeTasks.length,
                completedTasks,
                completionRate: employeeTasks.length ? Math.round((completedTasks / employeeTasks.length) * 100) : 0,
            };
        });
        const upcomingDeadlines = [
            ...tasks.filter((task) => task.deadline && task.status !== 'completed').map((task) => ({ type: 'task', name: task.title, date: task.deadline, status: task.status })),
            ...projects.filter((project) => project.deadline && project.status !== 'completed').map((project) => ({ type: 'project', name: project.name, date: project.deadline, status: project.status })),
        ].filter((item) => new Date(item.date) >= todayStart).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 12);

        return res.json({
            manager: scope.manager,
            department: scope.department,
            isDepartmentHead: scope.isDepartmentHead,
            employees: scope.employees,
            stats: {
                employees: scope.employees.length,
                teams: new Set(scope.employees.map((employee) => String(employee.team || '').trim().toLowerCase()).filter(Boolean)).size,
                projects: projects.length,
                tasks: tasks.length,
                pendingTasks: tasks.filter((task) => task.status === 'pending').length,
                inProgressTasks: tasks.filter((task) => task.status === 'in-process').length,
                completedTasks: tasks.filter((task) => task.status === 'completed').length,
                overdueTasks: tasks.filter((task) => task.status !== 'completed' && task.deadline && new Date(task.deadline) < now).length,
            },
            attendanceSummary,
            projects: projectProgress,
            employeeTaskStats,
            upcomingDeadlines,
            pendingLeaveRequests: pendingLeave,
            announcements,
            activities,
        });
    } catch (error) {
        console.error('Manager overview failed:', error.message);
        return res.status(500).json({ message: 'Could not load manager overview' });
    }
};