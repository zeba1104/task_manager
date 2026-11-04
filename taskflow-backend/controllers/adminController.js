const User = require('../models/User');
const Task = require('../models/Task');
const Attendance = require('../models/Attendance');
const Department = require('../models/Department');
const Project = require('../models/Project');
const LeaveRequest = require('../models/LeaveRequest');
const Announcement = require('../models/Announcement');
const Activity = require('../models/Activity');
const ProfileChangeRequest = require('../models/ProfileChangeRequest');
const logActivity = require('../activityLogger');
const getManagerScope = require('../managerScope');

const isAdmin = (req, res) => {
    if (req.userRole === 'Admin') return true;
    res.status(403).json({ message: 'Admin access required' });
    return false;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.getOverview = async (req, res) => {
    if (!isAdmin(req, res)) return;
    try {
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);
        const todayKey = now.toISOString().slice(0, 10);

        const [users, tasks, departments, projects, attendance, onLeave, leaveRequests, profileChangeRequests, activities] = await Promise.all([
            User.find().select('name email role department manager isActive createdAt').lean(),
            Task.find().select('title status deadline user project createdAt updatedAt').populate('user', 'name').lean(),
            Department.find().populate('head', 'name email role').sort({ name: 1 }).lean(),
            Project.find().populate('department', 'name').populate('manager', 'name').sort({ createdAt: -1 }).lean(),
            Attendance.find({ date: todayKey }).select('user clockIn').lean(),
            LeaveRequest.find({ status: 'approved', startDate: { $lte: todayEnd }, endDate: { $gte: todayStart } }).select('user').lean(),
            LeaveRequest.find({ status: 'pending' }).populate('user', 'name email department').sort({ createdAt: 1 }).limit(10).lean(),
            ProfileChangeRequest.find({ status: 'pending' }).populate('user', 'name email role department employeeId').sort({ createdAt: 1 }).limit(10).lean(),
            Activity.find().populate('actor', 'name role').sort({ createdAt: -1 }).limit(12).lean(),
        ]);

        const activeUsers = users.filter((user) => user.isActive !== false);
        const employees = activeUsers.filter((user) => user.role === 'Employee');
        const managers = activeUsers.filter((user) => user.role === 'Manager');
        const staff = activeUsers.filter((user) => user.role === 'Employee' || user.role === 'Manager');
        const departmentNames = new Set([
            ...departments.map((department) => department.name.trim().toLowerCase()),
            ...activeUsers.map((user) => String(user.department || '').trim().toLowerCase()).filter(Boolean),
        ]);
        const teamManagerIds = new Set(employees.map((employee) => String(employee.manager || '')).filter(Boolean));
        const attendanceByUser = new Map(attendance.map((record) => [String(record.user), record]));
        const onLeaveIds = new Set(onLeave.map((request) => String(request.user)));
        const attendanceSummary = { present: 0, absent: 0, late: 0, onLeave: 0 };

        staff.forEach((staffMember) => {
            const id = String(staffMember._id);
            if (onLeaveIds.has(id)) {
                attendanceSummary.onLeave++;
                return;
            }
            const record = attendanceByUser.get(id);
            if (!record?.clockIn) {
                attendanceSummary.absent++;
                return;
            }
            const clockIn = new Date(record.clockIn);
            if (clockIn.getHours() >= 9) attendanceSummary.late++;
            else attendanceSummary.present++;
        });

        const tasksByProject = new Map();
        tasks.forEach((task) => {
            const key = String(task.project || '').trim().toLowerCase();
            if (!key) return;
            const projectTasks = tasksByProject.get(key) || [];
            projectTasks.push(task);
            tasksByProject.set(key, projectTasks);
        });

        const projectProgress = projects.map((project) => {
            const projectTasks = tasksByProject.get(project.name.trim().toLowerCase()) || [];
            const completedTasks = projectTasks.filter((task) => task.status === 'completed').length;
            const progress = projectTasks.length
                ? Math.round((completedTasks / projectTasks.length) * 100)
                : (project.status === 'completed' ? 100 : 0);
            return { ...project, taskCount: projectTasks.length, completedTasks, progress };
        });

        const departmentDistribution = employees.reduce((distribution, employee) => {
            const name = String(employee.department || 'General').trim() || 'General';
            distribution[name] = (distribution[name] || 0) + 1;
            return distribution;
        }, {});

        const departmentMetrics = departments.map((department) => {
            const departmentName = String(department.name || '').trim().toLowerCase();
            const departmentUsers = activeUsers.filter((user) => String(user.department || '').trim().toLowerCase() === departmentName);
            const departmentEmployees = departmentUsers.filter((user) => user.role === 'Employee');
            const departmentManagers = departmentUsers.filter((user) => user.role === 'Manager');
            const departmentUserIds = new Set(departmentUsers.map((user) => String(user._id)));
            const departmentProjects = projects.filter((project) => String(project.department?._id || project.department || '') === String(department._id));
            const projectNames = new Set(departmentProjects.map((project) => String(project.name || '').trim().toLowerCase()));
            const departmentTasks = tasks.filter((task) => {
                const ownerId = String(task.user?._id || task.user || '');
                const projectName = String(task.project || '').trim().toLowerCase();
                return departmentUserIds.has(ownerId) || (projectName && projectNames.has(projectName));
            });
            const completedTasks = departmentTasks.filter((task) => task.status === 'completed').length;

            return {
                ...department,
                metrics: {
                    employees: departmentEmployees.length,
                    managers: departmentManagers.length,
                    teams: new Set(departmentUsers.map((user) => String(user.team || '').trim().toLowerCase()).filter(Boolean)).size,
                    projects: departmentProjects.length,
                    tasks: departmentTasks.length,
                    completedTasks,
                    completionRate: departmentTasks.length ? Math.round((completedTasks / departmentTasks.length) * 100) : 0,
                },
            };
        });

        const taskCounts = {
            pending: tasks.filter((task) => task.status === 'pending').length,
            inProgress: tasks.filter((task) => task.status === 'in-process').length,
            completed: tasks.filter((task) => task.status === 'completed').length,
            overdue: tasks.filter((task) => task.status !== 'completed' && task.deadline && new Date(task.deadline) < now).length,
        };

        return res.json({
            stats: {
                employees: employees.length,
                managers: managers.length,
                departments: departmentNames.size,
                teams: teamManagerIds.size,
                activeProjects: projects.filter((project) => project.status === 'active').length,
                tasks: tasks.length,
            },
            taskCounts,
            attendanceSummary,
            departmentDistribution: Object.entries(departmentDistribution)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count),
            departments: departmentMetrics,
            projects: projectProgress,
            leaveRequests,
            profileChangeRequests,
            activities,
        });
    } catch (error) {
        console.error('Admin overview failed:', error.message);
        return res.status(500).json({ message: 'Could not load admin overview' });
    }
};

exports.getDepartments = async (req, res) => {
    if (!isAdmin(req, res)) return;
    const departments = await Department.find({ isActive: true }).populate('head', 'name email').sort({ name: 1 }).lean();
    return res.json(departments);
};

exports.createDepartment = async (req, res) => {
    if (!isAdmin(req, res)) return;
    try {
        const name = String(req.body.name || '').trim();
        const code = String(req.body.code || '').trim().toUpperCase();
        if (!name || !code) return res.status(400).json({ message: 'Department name and code are required' });
        const existing = await Department.findOne({ $or: [
            { name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } },
            { code },
        ] });
        if (existing) return res.status(409).json({ message: existing.code === code ? 'Department code already exists' : 'Department name already exists' });
        if (req.body.head) {
            const head = await User.findById(req.body.head).select('role');
            if (!head || head.role !== 'Manager') return res.status(400).json({ message: 'Department head must be a manager' });
        }
        const department = await Department.create({ name, code, description: req.body.description || '', head: req.body.head || null, createdBy: req.userId });
        if (req.body.head) {
            const head = await User.findById(req.body.head);
            if (head && String(head.department || '').toLowerCase() !== name.toLowerCase()) {
                head.departmentHistory.push({ fromDepartment: head.department || 'General', toDepartment: name, changedBy: req.userId, changedAt: new Date() });
                head.department = name;
                await head.save();
            }
        }
        logActivity(req.userId, 'created', 'department', department.name);
        return res.status(201).json(department);
    } catch (error) {
        return res.status(500).json({ message: 'Could not create department' });
    }
};

exports.createProject = async (req, res) => {
    if (!['Admin', 'Manager'].includes(req.userRole)) return res.status(403).json({ message: 'Access denied' });
    try {
        const name = String(req.body.name || '').trim();
        if (!name) return res.status(400).json({ message: 'Project name is required' });
        const existing = await Project.findOne({ name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } });
        if (existing) return res.status(409).json({ message: 'Project already exists' });
        let departmentId = req.body.department || null;
        let projectManagerId = req.body.manager || null;
        if (req.userRole === 'Manager') {
            const scope = await getManagerScope(req.userId);
            if (!scope?.department) return res.status(403).json({ message: 'A department must be assigned by Admin before you can create projects' });
            if (departmentId && String(departmentId) !== String(scope.department._id)) {
                return res.status(403).json({ message: 'You can only create projects in your assigned department' });
            }
            departmentId = scope.department._id;
            projectManagerId = req.userId;
        }
        const project = await Project.create({
            name,
            description: req.body.description || '',
            department: departmentId,
            manager: projectManagerId,
            startDate: req.body.startDate || new Date(),
            deadline: req.body.deadline || null,
            status: req.body.status || 'active',
            createdBy: req.userId,
        });
        logActivity(req.userId, 'created', 'project', project.name);
        return res.status(201).json(project);
    } catch (error) {
        return res.status(400).json({ message: error.message || 'Could not create project' });
    }
};

exports.createAnnouncement = async (req, res) => {
    if (!['Admin', 'Manager'].includes(req.userRole)) return res.status(403).json({ message: 'Access denied' });
    try {
        const title = String(req.body.title || '').trim();
        const body = String(req.body.body || '').trim();
        if (!title || !body) return res.status(400).json({ message: 'Title and message are required' });
        let audience = req.body.audience || 'all';
        let departmentId = audience === 'department' ? req.body.department : null;
        if (req.userRole === 'Manager') {
            const scope = await getManagerScope(req.userId);
            if (!scope?.department) return res.status(403).json({ message: 'A department must be assigned by Admin before you can publish team announcements' });
            audience = 'department';
            departmentId = scope.department._id;
        }
        if (audience === 'department' && !departmentId) {
            return res.status(400).json({ message: 'Choose a department for this announcement' });
        }
        const announcement = await Announcement.create({
            title,
            body,
            audience,
            department: departmentId,
            publishedBy: req.userId,
        });
        logActivity(req.userId, 'published', 'announcement', announcement.title);
        return res.status(201).json(announcement);
    } catch (error) {
        return res.status(400).json({ message: error.message || 'Could not publish announcement' });
    }
};

exports.getAnnouncements = async (req, res) => {
    const filter = {};
    if (req.userRole === 'Employee' || req.userRole === 'Manager') {
        const user = await User.findById(req.userId).select('department');
        const department = await Department.findOne({ name: user?.department }).select('_id');
        filter.$or = [{ audience: 'all' }];
        if (department?._id) filter.$or.push({ audience: 'department', department: department._id });
    }
    const announcements = await Announcement.find(filter).populate('publishedBy', 'name').populate('department', 'name').sort({ publishedAt: -1 }).limit(20).lean();
    return res.json(announcements);
};

exports.createLeaveRequest = async (req, res) => {
    try {
        const startDate = new Date(req.body.startDate);
        const endDate = new Date(req.body.endDate);
        if (!req.body.startDate || !req.body.endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
            return res.status(400).json({ message: 'Enter a valid leave date range' });
        }
        const request = await LeaveRequest.create({
            user: req.userId,
            leaveType: req.body.leaveType || 'annual',
            startDate,
            endDate,
            reason: req.body.reason || '',
        });
        const user = await User.findById(req.userId).select('name');
        logActivity(req.userId, 'requested leave', 'leave request', user?.name || 'Employee');
        return res.status(201).json(request);
    } catch (error) {
        return res.status(400).json({ message: error.message || 'Could not submit leave request' });
    }
};

exports.getMyLeaveRequests = async (req, res) => {
    const requests = await LeaveRequest.find({ user: req.userId }).sort({ createdAt: -1 }).limit(20).lean();
    return res.json(requests);
};

exports.reviewLeaveRequest = async (req, res) => {
    if (!['Admin', 'Manager'].includes(req.userRole)) return res.status(403).json({ message: 'Access denied' });
    const status = req.body.status;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ message: 'Status must be approved or rejected' });
    try {
        const existing = await LeaveRequest.findById(req.params.id).select('user status');
        if (!existing) return res.status(404).json({ message: 'Leave request not found' });
        if (req.userRole === 'Manager') {
            const scope = await getManagerScope(req.userId);
            if (!scope?.memberIds.some((memberId) => String(memberId) === String(existing.user))) {
                return res.status(403).json({ message: 'You can only review leave for your assigned team or department' });
            }
        }
        const request = await LeaveRequest.findByIdAndUpdate(req.params.id, {
            status,
            reviewedBy: req.userId,
            reviewedAt: new Date(),
        }, { new: true, runValidators: true }).populate('user', 'name department');
        if (!request) return res.status(404).json({ message: 'Leave request not found' });
        logActivity(req.userId, status, 'leave request', request.user?.name || 'Employee');
        return res.json(request);
    } catch (error) {
        return res.status(400).json({ message: error.message || 'Could not update leave request' });
    }
};

exports.getProjects = async (req, res) => {
    let filter = {};
    if (req.userRole === 'Manager') {
        const scope = await getManagerScope(req.userId);
        if (!scope) return res.status(403).json({ message: 'Manager account is not active' });
        filter = scope.isDepartmentHead && scope.department
            ? { $or: [{ manager: req.userId }, { department: scope.department._id }] }
            : { manager: req.userId };
    } else if (req.userRole === 'Employee') {
        const tasks = await Task.find({ user: req.userId }).distinct('project');
        filter = { name: { $in: tasks.filter(Boolean) } };
    }
    const projects = await Project.find(filter).select('name status department deadline manager').sort({ name: 1 }).lean();
    return res.json(projects);
};

exports.updateDepartment = async (req, res) => {
    if (!isAdmin(req, res)) return;
    try {
        const current = await Department.findById(req.params.id);
        if (!current) return res.status(404).json({ message: 'Department not found' });
        const updates = {};
        if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
        if (req.body.code !== undefined) updates.code = String(req.body.code).trim().toUpperCase();
        if (req.body.description !== undefined) updates.description = String(req.body.description).trim();
        if (req.body.isActive !== undefined) updates.isActive = Boolean(req.body.isActive);
        if (req.body.head !== undefined) {
            if (req.body.head) {
                const head = await User.findById(req.body.head).select('role');
                if (!head || head.role !== 'Manager') return res.status(400).json({ message: 'Department head must be a manager' });
            }
            updates.head = req.body.head || null;
        }
        if (!updates.name && !updates.code && !updates.description && updates.isActive === undefined && updates.head === undefined) {
            return res.status(400).json({ message: 'No department changes provided' });
        }
        const nextName = updates.name || current.name;
        const nextCode = updates.code || current.code;
        const duplicate = await Department.findOne({
            _id: { $ne: current._id },
            $or: [
                { name: { $regex: `^${escapeRegex(nextName)}$`, $options: 'i' } },
                { code: nextCode },
            ],
        });
        if (duplicate) return res.status(409).json({ message: duplicate.code === nextCode ? 'Department code already exists' : 'Department name already exists' });
        const department = await Department.findByIdAndUpdate(current._id, updates, { new: true, runValidators: true }).populate('head', 'name email');
        if (updates.name && current.name.toLowerCase() !== updates.name.toLowerCase()) {
            const departmentUsers = await User.find({ department: current.name });
            for (const employee of departmentUsers) {
                employee.departmentHistory.push({ fromDepartment: current.name, toDepartment: updates.name, changedBy: req.userId, changedAt: new Date() });
                employee.department = updates.name;
                await employee.save();
            }
        }
        if (updates.head && String(updates.head) !== String(current.head || '')) {
            const head = await User.findById(updates.head);
            if (head && head.department.toLowerCase() !== department.name.toLowerCase()) {
                head.departmentHistory.push({ fromDepartment: head.department || 'General', toDepartment: department.name, changedBy: req.userId, changedAt: new Date() });
                head.department = department.name;
                await head.save();
            }
        }
        logActivity(req.userId, updates.isActive === undefined ? 'updated' : updates.isActive ? 'activated' : 'deactivated', 'department', department.name);
        return res.json(department);
    } catch (error) {
        return res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'Department code already exists' : error.message });
    }
};

exports.reviewProfileChangeRequest = async (req, res) => {
    if (!isAdmin(req, res)) return;
    const status = req.body.status;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ message: 'Status must be approved or rejected' });
    try {
        const request = await ProfileChangeRequest.findById(req.params.id).populate('user', 'name email department employeeId manager');
        if (!request) return res.status(404).json({ message: 'Profile change request not found' });
        if (request.status !== 'pending') return res.status(409).json({ message: 'This profile change request was already reviewed' });
        if (status === 'approved') {
            let value = request.requestedValue;
            const user = await User.findById(request.user._id);
            if (!user) return res.status(404).json({ message: 'Manager account not found' });
            if (request.field === 'email') {
                value = value.trim().toLowerCase();
                if (await User.exists({ _id: { $ne: user._id }, email: value })) return res.status(409).json({ message: 'That email is already in use' });
            } else if (request.field === 'employeeId') {
                value = value.trim().toUpperCase();
                if (await User.exists({ _id: { $ne: user._id }, employeeId: value })) return res.status(409).json({ message: 'That employee ID is already in use' });
            } else if (request.field === 'manager') {
                if (!await User.exists({ _id: value, role: { $in: ['Manager', 'Admin'] }, isActive: { $ne: false } })) {
                    return res.status(400).json({ message: 'Choose an active manager or admin as reporting authority' });
                }
            } else if (request.field === 'department') {
                const department = await Department.findOne({ name: { $regex: `^${escapeRegex(value.trim())}$`, $options: 'i' }, isActive: true });
                if (!department) return res.status(400).json({ message: 'Choose an active department' });
                value = department.name;
                user.departmentHistory.push({ fromDepartment: user.department || 'General', toDepartment: value, changedBy: req.userId, changedAt: new Date() });
            } else if (request.field === 'joiningDate') {
                const date = new Date(value);
                if (Number.isNaN(date.getTime())) return res.status(400).json({ message: 'Enter a valid joining date' });
                value = date;
            }
            user[request.field] = value;
            if (request.field === 'firstName' || request.field === 'lastName') {
                user.name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.name;
            }
            await user.save();
        }
        request.status = status;
        request.reviewedBy = req.userId;
        request.reviewedAt = new Date();
        await request.save();
        logActivity(req.userId, `${status} profile change`, 'manager profile', request.user.name);
        return res.json({ message: `Profile change ${status}`, request });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'The requested value is already in use' });
        return res.status(500).json({ message: 'Could not review profile change' });
    }
};