const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Task = require('../models/Task');
const Project = require('../models/Project');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const Announcement = require('../models/Announcement');
const Activity = require('../models/Activity');
const ProfileChangeRequest = require('../models/ProfileChangeRequest');
const EmployeeFeedback = require('../models/EmployeeFeedback');
const TransferRequest = require('../models/TransferRequest');
const AdminNotification = require('../models/AdminNotification');
const Department = require('../models/Department');
const logActivity = require('../activityLogger');
const getManagerScope = require('../managerScope');

const escapeRegex = (string) => String(string || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Normalize project status
const normalizeStatus = (status) => {
    if (!status) return 'Planning';
    const s = String(status).trim().toLowerCase();
    if (s === 'active' || s === 'in progress' || s === 'in-progress') return 'In Progress';
    if (s === 'paused' || s === 'on hold' || s === 'on-hold') return 'On Hold';
    if (s === 'completed') return 'Completed';
    if (s === 'planning') return 'Planning';
    return status;
};

// Normalize project priority
const normalizePriority = (priority) => {
    if (!priority) return 'Medium';
    const p = String(priority).trim().toLowerCase();
    if (p === 'critical') return 'Critical';
    if (p === 'high') return 'High';
    if (p === 'low') return 'Low';
    return 'Medium';
};

/* ==========================================================================
   MANAGER PROFILE & ACCOUNT
   ========================================================================== */

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

/* ==========================================================================
   MANAGER OVERVIEW
   ========================================================================== */

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
            ? { $or: [{ manager: req.userId }, { department: scope.department._id }, { createdBy: req.userId }] }
            : { $or: [{ manager: req.userId }, { createdBy: req.userId }] };
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
            const calculatedProgress = projectTasks.length ? Math.round((completedTasks / projectTasks.length) * 100) : (project.status === 'Completed' || project.status === 'completed' ? 100 : (project.progress || 0));
            return {
                ...project,
                taskCount: projectTasks.length,
                completedTasks,
                progress: calculatedProgress,
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
            ...projects.filter((project) => project.deadline && project.status !== 'Completed' && project.status !== 'completed').map((project) => ({ type: 'project', name: project.name, date: project.deadline, status: project.status })),
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

/* ==========================================================================
   1.3 TEAM MANAGEMENT CONTROLLER METHODS
   ========================================================================== */

/**
 * Get assigned employees list with details, designation, joining date, workload and attendance.
 * Managers monitor employees assigned by Admin.
 */
exports.getTeamMembers = async (req, res) => {
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

        const employeeIds = scope.employees.map((e) => e._id);

        const [tasks, attendances, leaves] = await Promise.all([
            Task.find({ user: { $in: employeeIds } }).select('title user status priority deadline project createdAt').lean(),
            Attendance.find({ user: { $in: employeeIds }, date: todayKey }).select('user clockIn clockOut').lean(),
            LeaveRequest.find({
                user: { $in: employeeIds },
                status: 'approved',
                startDate: { $lte: todayEnd },
                endDate: { $gte: todayStart }
            }).select('user leaveType').lean(),
        ]);

        const attendanceMap = new Map(attendances.map(a => [String(a.user), a]));
        const leaveMap = new Map(leaves.map(l => [String(l.user), l]));

        const teamsSet = new Set();
        const designationsSet = new Set();

        const enrichedEmployees = scope.employees.map((employee) => {
            const empIdStr = String(employee._id);
            const empTasks = tasks.filter(t => String(t.user) === empIdStr);
            const completed = empTasks.filter(t => t.status === 'completed').length;
            const inProgress = empTasks.filter(t => t.status === 'in-process').length;
            const pending = empTasks.filter(t => t.status === 'pending').length;
            const inReview = empTasks.filter(t => t.status === 'in-review').length;
            const overdueTasks = empTasks.filter(t => t.status !== 'completed' && t.deadline && new Date(t.deadline) < now);

            if (employee.team) teamsSet.add(employee.team);
            if (employee.designation) designationsSet.add(employee.designation);

            let todayStatus = 'absent';
            let clockInTime = null;
            if (leaveMap.has(empIdStr)) {
                todayStatus = 'on-leave';
            } else if (attendanceMap.has(empIdStr)) {
                clockInTime = attendanceMap.get(empIdStr).clockIn;
                if (clockInTime) {
                    todayStatus = new Date(clockInTime).getHours() >= 9 ? 'late' : 'present';
                }
            }

            const activeTasksCount = pending + inProgress + inReview;
            let workloadLevel = 'Low';
            if (activeTasksCount >= 6) workloadLevel = 'High';
            else if (activeTasksCount >= 3) workloadLevel = 'Moderate';

            return {
                ...employee,
                joiningDate: employee.joiningDate || employee.createdAt,
                workload: {
                    totalTasks: empTasks.length,
                    activeTasks: activeTasksCount,
                    completedTasks: completed,
                    inProgressTasks: inProgress,
                    pendingTasks: pending,
                    inReviewTasks: inReview,
                    overdueTasksCount: overdueTasks.length,
                    completionRate: empTasks.length ? Math.round((completed / empTasks.length) * 100) : 0,
                    workloadLevel,
                },
                todayAttendance: {
                    status: todayStatus,
                    clockIn: clockInTime,
                    leaveType: leaveMap.get(empIdStr)?.leaveType || null,
                },
                hasOverdue: overdueTasks.length > 0,
                overdueTasks,
            };
        });

        const totalTasksCount = tasks.length;
        const totalCompleted = tasks.filter(t => t.status === 'completed').length;
        const totalOverdue = tasks.filter(t => t.status !== 'completed' && t.deadline && new Date(t.deadline) < now).length;
        const presentCount = enrichedEmployees.filter(e => ['present', 'late'].includes(e.todayAttendance.status)).length;

        return res.json({
            employees: enrichedEmployees,
            filterOptions: {
                teams: Array.from(teamsSet).sort(),
                designations: Array.from(designationsSet).sort(),
            },
            summary: {
                totalEmployees: enrichedEmployees.length,
                totalTeams: teamsSet.size,
                totalTasks: totalTasksCount,
                completedTasks: totalCompleted,
                overdueTasks: totalOverdue,
                completionRate: totalTasksCount ? Math.round((totalCompleted / totalTasksCount) * 100) : 0,
                presentToday: presentCount,
                onLeaveToday: enrichedEmployees.filter(e => e.todayAttendance.status === 'on-leave').length,
            },
            department: scope.department,
            isDepartmentHead: scope.isDepartmentHead,
        });
    } catch (error) {
        console.error('getTeamMembers error:', error);
        return res.status(500).json({ message: 'Could not load team members' });
    }
};

/**
 * Get comprehensive employee profile for assigned employee.
 * Includes attendance history, leave history, assigned projects & tasks, workload metrics, and feedback.
 */
exports.getEmployeeProfile = async (req, res) => {
    if (req.userRole !== 'Manager') return res.status(403).json({ message: 'Manager access required' });
    try {
        const scope = await getManagerScope(req.userId);
        if (!scope) return res.status(403).json({ message: 'Manager account is not active' });

        const { id } = req.params;
        const isAuthorized = scope.employees.some(e => String(e._id) === String(id));
        if (!isAuthorized) {
            return res.status(403).json({ message: 'You can only view profiles of employees assigned to your team' });
        }

        const now = new Date();
        const [employee, tasks, attendance, leaveHistory, feedback, transferRequests] = await Promise.all([
            User.findById(id).select('-password').populate('manager', 'name email designation').lean(),
            Task.find({ user: id }).sort({ deadline: 1, createdAt: -1 }).lean(),
            Attendance.find({ user: id }).sort({ date: -1 }).limit(90).lean(),
            LeaveRequest.find({ user: id }).sort({ createdAt: -1 }).limit(30).lean(),
            EmployeeFeedback.find({ employee: id }).populate('manager', 'name email designation').sort({ createdAt: -1 }).lean(),
            TransferRequest.find({ employee: id }).populate('requestedBy', 'name email').sort({ createdAt: -1 }).lean(),
        ]);

        if (!employee) return res.status(404).json({ message: 'Employee not found' });

        // Get assigned projects
        const projectNames = [...new Set(tasks.map(t => t.project).filter(Boolean))];
        const projects = await Project.find({
            $or: [
                { assignedEmployees: id },
                { teamLead: id },
                { name: { $in: projectNames } }
            ]
        }).select('name description status priority deadline progress department').populate('department', 'name code').lean();

        const completedTasks = tasks.filter(t => t.status === 'completed');
        const inProgressTasks = tasks.filter(t => t.status === 'in-process');
        const pendingTasks = tasks.filter(t => t.status === 'pending');
        const overdueTasks = tasks.filter(t => t.status !== 'completed' && t.deadline && new Date(t.deadline) < now);

        return res.json({
            employee,
            tasks,
            projects,
            attendance,
            leaveHistory,
            feedback,
            transferRequests,
            metrics: {
                totalTasks: tasks.length,
                completedTasks: completedTasks.length,
                inProgressTasks: inProgressTasks.length,
                pendingTasks: pendingTasks.length,
                overdueTasksCount: overdueTasks.length,
                completionRate: tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : 0,
                attendanceCount: attendance.length,
                approvedLeavesCount: leaveHistory.filter(l => l.status === 'approved').length,
            },
            overdueTasks,
        });
    } catch (error) {
        console.error('getEmployeeProfile error:', error);
        return res.status(500).json({ message: 'Could not load employee profile' });
    }
};

/**
 * Provide employee feedback (Section 1.3).
 */
exports.addEmployeeFeedback = async (req, res) => {
    if (req.userRole !== 'Manager') return res.status(403).json({ message: 'Manager access required' });
    try {
        const scope = await getManagerScope(req.userId);
        if (!scope) return res.status(403).json({ message: 'Manager account is not active' });

        const { id } = req.params;
        const isAuthorized = scope.employees.some(e => String(e._id) === String(id));
        if (!isAuthorized) {
            return res.status(403).json({ message: 'You can only provide feedback for employees in your team' });
        }

        const { feedbackType, rating, comments } = req.body;
        if (!comments || !String(comments).trim()) {
            return res.status(400).json({ message: 'Feedback comment is required' });
        }

        const employee = await User.findById(id).select('name');
        if (!employee) return res.status(404).json({ message: 'Employee not found' });

        const feedback = await EmployeeFeedback.create({
            employee: id,
            manager: req.userId,
            feedbackType: feedbackType || 'General',
            rating: Number(rating) || 5,
            comments: String(comments).trim(),
        });

        logActivity(req.userId, 'provided feedback for', 'employee', employee.name);
        return res.status(201).json(await feedback.populate('manager', 'name email designation'));
    } catch (error) {
        console.error('addEmployeeFeedback error:', error);
        return res.status(500).json({ message: 'Could not submit feedback' });
    }
};

/**
 * Request employee transfer or team change through Admin (Section 1.3).
 */
exports.requestEmployeeTransfer = async (req, res) => {
    if (req.userRole !== 'Manager') return res.status(403).json({ message: 'Manager access required' });
    try {
        const scope = await getManagerScope(req.userId);
        if (!scope) return res.status(403).json({ message: 'Manager account is not active' });

        const { employeeId, targetDepartment, targetTeam, targetManager, reason } = req.body;
        if (!employeeId || !targetDepartment || !reason) {
            return res.status(400).json({ message: 'Employee, target department, and reason are required' });
        }

        const employee = scope.employees.find(e => String(e._id) === String(employeeId));
        if (!employee) {
            return res.status(403).json({ message: 'You can only request transfers for employees in your team' });
        }

        const existingPending = await TransferRequest.findOne({ employee: employeeId, status: 'pending' });
        if (existingPending) {
            return res.status(409).json({ message: 'A transfer request for this employee is already pending Admin review' });
        }

        const transferRequest = await TransferRequest.create({
            employee: employeeId,
            requestedBy: req.userId,
            currentDepartment: employee.department || 'General',
            currentTeam: employee.team || '',
            targetDepartment: String(targetDepartment).trim(),
            targetTeam: String(targetTeam || '').trim(),
            targetManager: targetManager || null,
            reason: String(reason).trim(),
            status: 'pending',
        });

        // Notify Admin
        await AdminNotification.create({
            title: `Transfer Request: ${employee.name}`,
            message: `Manager ${scope.manager.name} requested transfer for ${employee.name} (${employee.employeeId || 'ID: ' + employee._id}) from ${employee.department} - ${employee.team || 'No team'} to ${targetDepartment}${targetTeam ? ' (' + targetTeam + ')' : ''}. Reason: ${reason}`,
            type: 'transfer_request',
            priority: 'Medium',
            employee: employee._id,
            sender: req.userId,
        });

        logActivity(req.userId, 'submitted transfer request for', 'employee', employee.name);
        return res.status(201).json(transferRequest);
    } catch (error) {
        console.error('requestEmployeeTransfer error:', error);
        return res.status(500).json({ message: 'Could not submit transfer request' });
    }
};

/**
 * Get transfer requests submitted by this manager.
 */
exports.getTransferRequests = async (req, res) => {
    if (req.userRole !== 'Manager') return res.status(403).json({ message: 'Manager access required' });
    try {
        const requests = await TransferRequest.find({ requestedBy: req.userId })
            .populate('employee', 'name employeeId designation team department')
            .populate('reviewedBy', 'name')
            .sort({ createdAt: -1 })
            .lean();
        return res.json(requests);
    } catch (error) {
        return res.status(500).json({ message: 'Could not load transfer requests' });
    }
};

/**
 * View team-wise performance reports (Section 1.3).
 */
exports.getTeamPerformanceReports = async (req, res) => {
    if (req.userRole !== 'Manager') return res.status(403).json({ message: 'Manager access required' });
    try {
        const scope = await getManagerScope(req.userId);
        if (!scope) return res.status(403).json({ message: 'Manager account is not active' });

        const now = new Date();
        const todayKey = now.toISOString().slice(0, 10);
        const employeeIds = scope.employees.map(e => e._id);

        const [tasks, attendances] = await Promise.all([
            Task.find({ user: { $in: employeeIds } }).select('status deadline user createdAt').lean(),
            Attendance.find({ user: { $in: employeeIds }, date: todayKey }).select('user clockIn').lean(),
        ]);

        const attendanceSet = new Set(attendances.filter(a => a.clockIn).map(a => String(a.user)));

        // Group by team
        const teamGroups = new Map();
        scope.employees.forEach(employee => {
            const teamName = employee.team ? employee.team.trim() : 'General / Unassigned';
            if (!teamGroups.has(teamName)) {
                teamGroups.set(teamName, {
                    teamName,
                    members: [],
                    tasks: [],
                });
            }
            const group = teamGroups.get(teamName);
            group.members.push(employee);
        });

        tasks.forEach(task => {
            const emp = scope.employees.find(e => String(e._id) === String(task.user));
            if (emp) {
                const teamName = emp.team ? emp.team.trim() : 'General / Unassigned';
                const group = teamGroups.get(teamName);
                if (group) group.tasks.push(task);
            }
        });

        const reports = Array.from(teamGroups.values()).map(group => {
            const memberCount = group.members.length;
            const groupTasks = group.tasks;
            const completedCount = groupTasks.filter(t => t.status === 'completed').length;
            const inProgressCount = groupTasks.filter(t => t.status === 'in-process').length;
            const pendingCount = groupTasks.filter(t => t.status === 'pending').length;
            const overdueCount = groupTasks.filter(t => t.status !== 'completed' && t.deadline && new Date(t.deadline) < now).length;
            const completionRate = groupTasks.length ? Math.round((completedCount / groupTasks.length) * 100) : 0;

            const presentCount = group.members.filter(m => attendanceSet.has(String(m._id))).length;
            const attendanceRate = memberCount ? Math.round((presentCount / memberCount) * 100) : 0;

            let performanceGrade = 'Good';
            if (completionRate >= 80 && overdueCount === 0) performanceGrade = 'Outstanding';
            else if (completionRate >= 65 && overdueCount <= 2) performanceGrade = 'Good';
            else if (completionRate >= 45) performanceGrade = 'Moderate';
            else performanceGrade = 'Needs Attention';

            return {
                teamName: group.teamName,
                memberCount,
                members: group.members.map(m => ({ id: m._id, name: m.name, employeeId: m.employeeId, designation: m.designation })),
                totalTasks: groupTasks.length,
                completedTasks: completedCount,
                inProgressTasks: inProgressCount,
                pendingTasks: pendingCount,
                overdueTasks: overdueCount,
                completionRate,
                presentCount,
                attendanceRate,
                performanceGrade,
            };
        });

        return res.json({
            department: scope.department,
            reports,
            overallSummary: {
                totalTeams: reports.length,
                totalEmployees: scope.employees.length,
                totalTasks: tasks.length,
                completedTasks: tasks.filter(t => t.status === 'completed').length,
                overdueTasks: tasks.filter(t => t.status !== 'completed' && t.deadline && new Date(t.deadline) < now).length,
                generatedAt: new Date(),
            }
        });
    } catch (error) {
        console.error('getTeamPerformanceReports error:', error);
        return res.status(500).json({ message: 'Could not generate performance reports' });
    }
};

/* ==========================================================================
   1.4 PROJECT MANAGEMENT CONTROLLER METHODS
   ========================================================================== */

/**
 * Get manager projects within authorized scope with progress, milestones, deadline tracking.
 */
exports.getManagerProjects = async (req, res) => {
    if (req.userRole !== 'Manager') return res.status(403).json({ message: 'Manager access required' });
    try {
        const scope = await getManagerScope(req.userId);
        if (!scope) return res.status(403).json({ message: 'Manager account is not active' });

        const projectFilter = scope.isDepartmentHead && scope.department
            ? { $or: [{ manager: req.userId }, { department: scope.department._id }, { createdBy: req.userId }] }
            : { $or: [{ manager: req.userId }, { createdBy: req.userId }, { teamLead: req.userId }] };

        const projects = await Project.find(projectFilter)
            .populate('department', 'name code')
            .populate('manager', 'name email designation')
            .populate('teamLead', 'name email designation employeeId')
            .populate('assignedEmployees', 'name email employeeId designation team')
            .sort({ deadline: 1, createdAt: -1 })
            .lean();

        const projectNames = projects.map(p => p.name);
        const tasks = await Task.find({ project: { $in: projectNames } }).select('project status priority deadline user').lean();

        const now = new Date();
        const enrichedProjects = projects.map(project => {
            const projectTasks = tasks.filter(t => String(t.project || '').toLowerCase() === project.name.toLowerCase());
            const completedTasks = projectTasks.filter(t => t.status === 'completed').length;
            const inProgressTasks = projectTasks.filter(t => t.status === 'in-process').length;
            const overdueTasks = projectTasks.filter(t => t.status !== 'completed' && t.deadline && new Date(t.deadline) < now).length;
            
            const milestones = project.milestones || [];
            const completedMilestones = milestones.filter(m => m.completed).length;

            const isProjectOverdue = project.deadline && new Date(project.deadline) < now && project.status !== 'Completed' && project.status !== 'completed';
            const daysRemaining = project.deadline ? Math.ceil((new Date(project.deadline) - now) / (1000 * 60 * 60 * 24)) : null;

            const calculatedProgress = projectTasks.length 
                ? Math.round((completedTasks / projectTasks.length) * 100) 
                : (project.status === 'Completed' || project.status === 'completed' ? 100 : (project.progress || 0));

            return {
                ...project,
                status: normalizeStatus(project.status),
                priority: normalizePriority(project.priority),
                taskCount: projectTasks.length,
                completedTasks,
                inProgressTasks,
                overdueTasks,
                progress: calculatedProgress,
                milestonesCount: milestones.length,
                completedMilestonesCount: completedMilestones,
                documentsCount: (project.documents || []).length,
                commentsCount: (project.comments || []).length,
                isOverdue: isProjectOverdue,
                daysRemaining,
            };
        });

        return res.json(enrichedProjects);
    } catch (error) {
        console.error('getManagerProjects error:', error);
        return res.status(500).json({ message: 'Could not load projects' });
    }
};

/**
 * Get project details with milestones, documents, comments, and individual employee contributions.
 */
exports.getManagerProjectDetails = async (req, res) => {
    if (req.userRole !== 'Manager') return res.status(403).json({ message: 'Manager access required' });
    try {
        const { id } = req.params;
        const project = await Project.findById(id)
            .populate('department', 'name code')
            .populate('manager', 'name email designation phone')
            .populate('teamLead', 'name email designation employeeId')
            .populate('assignedEmployees', 'name email employeeId designation team')
            .populate('createdBy', 'name email')
            .populate('documents.uploadedBy', 'name email')
            .populate('comments.user', 'name role designation')
            .lean();

        if (!project) return res.status(404).json({ message: 'Project not found' });

        const tasks = await Task.find({ project: project.name })
            .populate('user', 'name employeeId designation team')
            .sort({ deadline: 1 })
            .lean();

        const now = new Date();
        const completedTasks = tasks.filter(t => t.status === 'completed');
        const inProgressTasks = tasks.filter(t => t.status === 'in-process');
        const pendingTasks = tasks.filter(t => t.status === 'pending');
        const overdueTasks = tasks.filter(t => t.status !== 'completed' && t.deadline && new Date(t.deadline) < now);

        // Individual employee contribution breakdown
        const memberMap = new Map();
        (project.assignedEmployees || []).forEach(emp => {
            memberMap.set(String(emp._id), {
                id: emp._id,
                name: emp.name,
                employeeId: emp.employeeId,
                designation: emp.designation,
                team: emp.team,
                assignedTasks: 0,
                completedTasks: 0,
                inProgressTasks: 0,
                pendingTasks: 0,
                overdueTasks: 0,
            });
        });

        tasks.forEach(t => {
            const uid = String(t.user?._id || t.user);
            if (!memberMap.has(uid) && t.user?.name) {
                memberMap.set(uid, {
                    id: uid,
                    name: t.user.name,
                    employeeId: t.user.employeeId,
                    designation: t.user.designation,
                    team: t.user.team,
                    assignedTasks: 0,
                    completedTasks: 0,
                    inProgressTasks: 0,
                    pendingTasks: 0,
                    overdueTasks: 0,
                });
            }
            const empStats = memberMap.get(uid);
            if (empStats) {
                empStats.assignedTasks++;
                if (t.status === 'completed') empStats.completedTasks++;
                else if (t.status === 'in-process') empStats.inProgressTasks++;
                else if (t.status === 'pending') empStats.pendingTasks++;
                if (t.status !== 'completed' && t.deadline && new Date(t.deadline) < now) empStats.overdueTasks++;
            }
        });

        const contributions = Array.from(memberMap.values()).map(emp => ({
            ...emp,
            completionRate: emp.assignedTasks ? Math.round((emp.completedTasks / emp.assignedTasks) * 100) : 0,
            contributionShare: completedTasks.length ? Math.round((emp.completedTasks / completedTasks.length) * 100) : 0,
        }));

        const isOverdue = project.deadline && new Date(project.deadline) < now && project.status !== 'Completed' && project.status !== 'completed';
        const daysRemaining = project.deadline ? Math.ceil((new Date(project.deadline) - now) / (1000 * 60 * 60 * 24)) : null;

        return res.json({
            project: {
                ...project,
                status: normalizeStatus(project.status),
                priority: normalizePriority(project.priority),
                isOverdue,
                daysRemaining,
            },
            tasks,
            contributions,
            taskStats: {
                total: tasks.length,
                completed: completedTasks.length,
                inProgress: inProgressTasks.length,
                pending: pendingTasks.length,
                overdue: overdueTasks.length,
                completionRate: tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : 0,
            },
        });
    } catch (error) {
        console.error('getManagerProjectDetails error:', error);
        return res.status(500).json({ message: 'Could not load project details' });
    }
};

/**
 * Create new project within authorized departments.
 * Enter name, description, objectives, requirements, dates, priorities, assigned team, team lead, milestones.
 */
exports.createManagerProject = async (req, res) => {
    if (req.userRole !== 'Manager') return res.status(403).json({ message: 'Manager access required' });
    try {
        const scope = await getManagerScope(req.userId);
        if (!scope?.department) {
            return res.status(403).json({ message: 'An authorized department must be assigned by Admin before you can create projects' });
        }

        const name = String(req.body.name || '').trim();
        if (!name) return res.status(400).json({ message: 'Project name is required' });

        const existing = await Project.findOne({ name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } });
        if (existing) return res.status(409).json({ message: 'A project with this name already exists' });

        // Ensure assigned employees and team lead are from authorized scope
        const authorizedMemberIds = new Set(scope.memberIds.map(id => String(id)));

        let assignedEmployees = [];
        if (Array.isArray(req.body.assignedEmployees)) {
            assignedEmployees = req.body.assignedEmployees.filter(id => authorizedMemberIds.has(String(id)));
        }

        let teamLead = req.body.teamLead || null;
        if (teamLead && !authorizedMemberIds.has(String(teamLead))) {
            teamLead = null;
        }

        let milestones = [];
        if (Array.isArray(req.body.milestones)) {
            milestones = req.body.milestones.map(m => ({
                title: String(m.title || '').trim(),
                description: String(m.description || '').trim(),
                deliverables: String(m.deliverables || '').trim(),
                dueDate: m.dueDate ? new Date(m.dueDate) : null,
                completed: Boolean(m.completed),
            })).filter(m => m.title);
        }

        const project = await Project.create({
            name,
            description: String(req.body.description || '').trim(),
            objectives: String(req.body.objectives || '').trim(),
            requirements: String(req.body.requirements || '').trim(),
            department: scope.department._id,
            manager: req.userId,
            teamLead,
            assignedEmployees,
            priority: normalizePriority(req.body.priority),
            status: normalizeStatus(req.body.status || 'Planning'),
            startDate: req.body.startDate ? new Date(req.body.startDate) : new Date(),
            deadline: req.body.deadline ? new Date(req.body.deadline) : null,
            progress: Number(req.body.progress) || 0,
            milestones,
            createdBy: req.userId,
        });

        logActivity(req.userId, 'created project', 'project', project.name);
        return res.status(201).json(await Project.findById(project._id)
            .populate('department', 'name code')
            .populate('teamLead', 'name email designation')
            .populate('assignedEmployees', 'name email designation team'));
    } catch (error) {
        console.error('createManagerProject error:', error);
        return res.status(400).json({ message: error.message || 'Could not create project' });
    }
};

/**
 * Update project details (status, progress, objectives, requirements, priority, dates, team lead, assigned employees).
 */
exports.updateManagerProject = async (req, res) => {
    if (req.userRole !== 'Manager') return res.status(403).json({ message: 'Manager access required' });
    try {
        const { id } = req.params;
        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        const allowedFields = ['name', 'description', 'objectives', 'requirements', 'startDate', 'deadline', 'priority', 'status', 'progress', 'teamLead', 'assignedEmployees'];
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                if (field === 'status') project.status = normalizeStatus(req.body.status);
                else if (field === 'priority') project.priority = normalizePriority(req.body.priority);
                else project[field] = req.body[field];
            }
        });

        if (project.status === 'Completed' && req.body.progress === undefined) {
            project.progress = 100;
        }

        await project.save();
        logActivity(req.userId, 'updated project', 'project', project.name);

        const updated = await Project.findById(project._id)
            .populate('department', 'name code')
            .populate('teamLead', 'name email designation')
            .populate('assignedEmployees', 'name email designation team');

        return res.json(updated);
    } catch (error) {
        console.error('updateManagerProject error:', error);
        return res.status(400).json({ message: error.message || 'Could not update project' });
    }
};

/**
 * Add milestone and deliverables to project.
 */
exports.addProjectMilestone = async (req, res) => {
    if (req.userRole !== 'Manager') return res.status(403).json({ message: 'Manager access required' });
    try {
        const { id } = req.params;
        const { title, description, deliverables, dueDate } = req.body;
        if (!title || !String(title).trim()) {
            return res.status(400).json({ message: 'Milestone title is required' });
        }

        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        project.milestones.push({
            title: String(title).trim(),
            description: String(description || '').trim(),
            deliverables: String(deliverables || '').trim(),
            dueDate: dueDate ? new Date(dueDate) : null,
            completed: false,
        });

        await project.save();
        logActivity(req.userId, 'added milestone to project', 'project', project.name);
        return res.status(201).json(project.milestones);
    } catch (error) {
        return res.status(500).json({ message: 'Could not add milestone' });
    }
};

/**
 * Update milestone status or details.
 */
exports.updateProjectMilestone = async (req, res) => {
    if (req.userRole !== 'Manager') return res.status(403).json({ message: 'Manager access required' });
    try {
        const { id, milestoneId } = req.params;
        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        const milestone = project.milestones.id(milestoneId);
        if (!milestone) return res.status(404).json({ message: 'Milestone not found' });

        if (req.body.title !== undefined) milestone.title = String(req.body.title).trim();
        if (req.body.description !== undefined) milestone.description = String(req.body.description).trim();
        if (req.body.deliverables !== undefined) milestone.deliverables = String(req.body.deliverables).trim();
        if (req.body.dueDate !== undefined) milestone.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
        if (req.body.completed !== undefined) {
            milestone.completed = Boolean(req.body.completed);
            milestone.completedAt = milestone.completed ? new Date() : null;
        }

        await project.save();
        return res.json(project.milestones);
    } catch (error) {
        return res.status(500).json({ message: 'Could not update milestone' });
    }
};

/**
 * Delete milestone from project.
 */
exports.deleteProjectMilestone = async (req, res) => {
    if (req.userRole !== 'Manager') return res.status(403).json({ message: 'Manager access required' });
    try {
        const { id, milestoneId } = req.params;
        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        project.milestones.pull(milestoneId);
        await project.save();
        return res.json(project.milestones);
    } catch (error) {
        return res.status(500).json({ message: 'Could not delete milestone' });
    }
};

/**
 * Upload project document.
 */
exports.uploadProjectDocument = async (req, res) => {
    if (req.userRole !== 'Manager') return res.status(403).json({ message: 'Manager access required' });
    if (!req.file) return res.status(400).json({ message: 'Please select a document to upload' });
    try {
        const { id } = req.params;
        const project = await Project.findById(id);
        if (!project) {
            await fs.promises.unlink(req.file.path).catch(() => {});
            return res.status(404).json({ message: 'Project not found' });
        }

        project.documents.push({
            originalName: req.file.originalname,
            fileName: req.file.filename,
            contentType: req.file.mimetype,
            size: req.file.size,
            uploadedBy: req.userId,
            createdAt: new Date(),
        });

        await project.save();
        logActivity(req.userId, 'uploaded document to project', 'project', project.name);
        const populated = await Project.findById(project._id).populate('documents.uploadedBy', 'name');
        return res.status(201).json(populated.documents);
    } catch (error) {
        if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(500).json({ message: 'Could not upload document' });
    }
};

/**
 * Download project document.
 */
exports.downloadProjectDocument = async (req, res) => {
    try {
        const { id, docId } = req.params;
        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        const doc = project.documents.id(docId);
        if (!doc) return res.status(404).json({ message: 'Document not found' });

        const filePath = path.join(__dirname, '..', 'uploads', 'project-documents', path.basename(doc.fileName));
        if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Document file not found on disk' });

        return res.download(filePath, doc.originalName);
    } catch (error) {
        return res.status(500).json({ message: 'Could not download document' });
    }
};

/**
 * Delete project document.
 */
exports.deleteProjectDocument = async (req, res) => {
    if (req.userRole !== 'Manager') return res.status(403).json({ message: 'Manager access required' });
    try {
        const { id, docId } = req.params;
        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        const doc = project.documents.id(docId);
        if (!doc) return res.status(404).json({ message: 'Document not found' });

        const filePath = path.join(__dirname, '..', 'uploads', 'project-documents', path.basename(doc.fileName));
        if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath).catch(() => {});
        }

        project.documents.pull(docId);
        await project.save();
        logActivity(req.userId, 'deleted document from project', 'project', project.name);
        return res.json({ message: 'Document removed', documents: project.documents });
    } catch (error) {
        return res.status(500).json({ message: 'Could not delete document' });
    }
};

/**
 * Add project comment or update.
 */
exports.addProjectComment = async (req, res) => {
    if (!['Manager', 'Admin', 'Employee'].includes(req.userRole)) return res.status(403).json({ message: 'Access denied' });
    try {
        const { id } = req.params;
        const { text } = req.body;
        if (!text || !String(text).trim()) return res.status(400).json({ message: 'Comment text is required' });

        const project = await Project.findById(id);
        if (!project) return res.status(404).json({ message: 'Project not found' });

        project.comments.push({
            text: String(text).trim(),
            user: req.userId,
            createdAt: new Date(),
        });

        await project.save();
        const populated = await Project.findById(project._id).populate('comments.user', 'name role designation');
        return res.status(201).json(populated.comments);
    } catch (error) {
        return res.status(500).json({ message: 'Could not add comment' });
    }
};

/**
 * Notify Admin about important project updates (Section 1.4).
 */
exports.notifyAdminProjectUpdate = async (req, res) => {
    if (req.userRole !== 'Manager') return res.status(403).json({ message: 'Manager access required' });
    try {
        const { id } = req.params;
        const { title, message, priority } = req.body;
        if (!title || !message) return res.status(400).json({ message: 'Title and update message are required' });

        const project = await Project.findById(id).populate('department', 'name');
        if (!project) return res.status(404).json({ message: 'Project not found' });

        const manager = await User.findById(req.userId).select('name email');

        const notification = await AdminNotification.create({
            title: `[Project Update] ${project.name}: ${title}`,
            message: `Update from Manager ${manager.name}: ${message}`,
            type: 'project_update',
            priority: normalizePriority(priority || project.priority),
            project: project._id,
            sender: req.userId,
        });

        // Add to project comment feed as official update
        project.comments.push({
            text: `[Admin Alert - ${priority || 'High'}] ${title}: ${message}`,
            user: req.userId,
            createdAt: new Date(),
        });
        await project.save();

        logActivity(req.userId, 'notified Admin of project update', 'project', project.name);
        return res.status(201).json({ message: 'Admin has been notified successfully', notification });
    } catch (error) {
        console.error('notifyAdminProjectUpdate error:', error);
        return res.status(500).json({ message: 'Could not send update notification to Admin' });
    }
};

/**
 * Generate project progress report data (Section 1.4).
 */
exports.generateProjectProgressReport = async (req, res) => {
    if (req.userRole !== 'Manager') return res.status(403).json({ message: 'Manager access required' });
    try {
        const { id } = req.params;
        const project = await Project.findById(id)
            .populate('department', 'name code')
            .populate('manager', 'name email designation phone')
            .populate('teamLead', 'name email designation employeeId')
            .populate('assignedEmployees', 'name email employeeId designation team')
            .populate('documents.uploadedBy', 'name')
            .populate('comments.user', 'name role')
            .lean();

        if (!project) return res.status(404).json({ message: 'Project not found' });

        const tasks = await Task.find({ project: project.name })
            .populate('user', 'name employeeId designation team')
            .sort({ deadline: 1 })
            .lean();

        const now = new Date();
        const completedTasks = tasks.filter(t => t.status === 'completed');
        const inProgressTasks = tasks.filter(t => t.status === 'in-process');
        const pendingTasks = tasks.filter(t => t.status === 'pending');
        const overdueTasks = tasks.filter(t => t.status !== 'completed' && t.deadline && new Date(t.deadline) < now);

        const memberMap = new Map();
        (project.assignedEmployees || []).forEach(emp => {
            memberMap.set(String(emp._id), {
                id: emp._id,
                name: emp.name,
                employeeId: emp.employeeId,
                designation: emp.designation,
                team: emp.team,
                assignedTasks: 0,
                completedTasks: 0,
                inProgressTasks: 0,
                overdueTasks: 0,
            });
        });

        tasks.forEach(t => {
            const uid = String(t.user?._id || t.user);
            if (!memberMap.has(uid) && t.user?.name) {
                memberMap.set(uid, {
                    id: uid,
                    name: t.user.name,
                    employeeId: t.user.employeeId,
                    designation: t.user.designation,
                    team: t.user.team,
                    assignedTasks: 0,
                    completedTasks: 0,
                    inProgressTasks: 0,
                    overdueTasks: 0,
                });
            }
            const empStats = memberMap.get(uid);
            if (empStats) {
                empStats.assignedTasks++;
                if (t.status === 'completed') empStats.completedTasks++;
                else if (t.status === 'in-process') empStats.inProgressTasks++;
                if (t.status !== 'completed' && t.deadline && new Date(t.deadline) < now) empStats.overdueTasks++;
            }
        });

        const contributions = Array.from(memberMap.values()).map(emp => ({
            ...emp,
            completionRate: emp.assignedTasks ? Math.round((emp.completedTasks / emp.assignedTasks) * 100) : 0,
            contributionShare: completedTasks.length ? Math.round((emp.completedTasks / completedTasks.length) * 100) : 0,
        }));

        const milestones = project.milestones || [];
        const completedMilestones = milestones.filter(m => m.completed).length;

        const milestoneProgress = milestones.length ? Math.round((completedMilestones / milestones.length) * 100) : 0;
        const taskProgress = tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : 0;
        const overallProgress = project.progress || (milestones.length ? Math.round((milestoneProgress + taskProgress) / 2) : taskProgress);

        return res.json({
            project: {
                ...project,
                status: normalizeStatus(project.status),
                priority: normalizePriority(project.priority),
            },
            summary: {
                totalTasks: tasks.length,
                completedTasks: completedTasks.length,
                inProgressTasks: inProgressTasks.length,
                pendingTasks: pendingTasks.length,
                overdueTasks: overdueTasks.length,
                taskProgress,
                totalMilestones: milestones.length,
                completedMilestones,
                milestoneProgress,
                overallProgress,
                isOverdue: project.deadline && new Date(project.deadline) < now && project.status !== 'Completed' && project.status !== 'completed',
                daysRemaining: project.deadline ? Math.ceil((new Date(project.deadline) - now) / (1000 * 60 * 60 * 24)) : null,
                generatedAt: new Date(),
            },
            tasks,
            contributions,
            milestones,
            documents: project.documents || [],
            recentUpdates: (project.comments || []).slice(-10).reverse(),
        });
    } catch (error) {
        console.error('generateProjectProgressReport error:', error);
        return res.status(500).json({ message: 'Could not generate report' });
    }
};


/* ==========================================================================
   TASK REVIEW WORKFLOW (1.3 / 1.4)
   ========================================================================== */

exports.getTasksForReview = async (req, res) => {
    if (req.userRole !== 'Manager') return res.status(403).json({ message: 'Manager access required' });
    try {
        const scope = await getManagerScope(req.userId);
        if (!scope) return res.status(403).json({ message: 'Manager account is not active' });
        
        const tasks = await Task.find({
            user: { $in: scope.memberIds },
            $or: [
                { status: 'in-review' },
                { reviewStatus: { $in: ['submitted', 'changes-requested'] } }
            ]
        })
        .populate('user', 'name email designation employeeId department team')
        .populate('assignedBy', 'name')
        .populate('attachments.user', 'name')
        .populate('managerFeedback.manager', 'name')
        .sort({ updatedAt: -1 })
        .lean();

        return res.json(tasks);
    } catch (error) {
        console.error('getTasksForReview error:', error);
        return res.status(500).json({ message: 'Could not load tasks for review' });
    }
};

exports.reviewTask = async (req, res) => {
    if (req.userRole !== 'Manager') return res.status(403).json({ message: 'Manager access required' });
    try {
        const { id } = req.params;
        const { action, feedback } = req.body;
        if (!['approve', 'request-changes'].includes(action)) {
            return res.status(400).json({ message: 'Action must be approve or request-changes' });
        }

        const scope = await getManagerScope(req.userId);
        if (!scope) return res.status(403).json({ message: 'Manager account is not active' });

        const task = await Task.findById(id).populate('user', 'name');
        if (!task) return res.status(404).json({ message: 'Task not found' });

        if (!scope.memberIds.some(mId => String(mId) === String(task.user._id || task.user))) {
            return res.status(403).json({ message: 'You can only review tasks within your assigned team' });
        }

        if (action === 'approve') {
            task.status = 'completed';
            task.reviewStatus = 'approved';
            task.managerFeedback.push({
                text: feedback || 'Task approved by manager.',
                manager: req.userId,
                requestedChanges: false,
                createdAt: new Date(),
            });
            task.history.push({
                action: 'Task approved by manager',
                performedBy: req.userId,
                details: feedback || 'Approved',
                createdAt: new Date(),
            });
            logActivity(req.userId, 'approved task', 'task', task.title, `Assigned to ${task.user?.name}`);
        } else {
            task.status = 'in-process';
            task.reviewStatus = 'changes-requested';
            task.managerFeedback.push({
                text: feedback || 'Modifications requested. Please review notes and resubmit.',
                manager: req.userId,
                requestedChanges: true,
                createdAt: new Date(),
            });
            task.history.push({
                action: 'Modifications requested by manager',
                performedBy: req.userId,
                details: feedback || 'Modifications requested',
                createdAt: new Date(),
            });
            logActivity(req.userId, 'requested task modifications', 'task', task.title, `Assigned to ${task.user?.name}`);
        }

        await task.save();
        return res.json({ message: action === 'approve' ? 'Task approved successfully' : 'Modifications requested', task });
    } catch (error) {
        console.error('reviewTask error:', error);
        return res.status(500).json({ message: 'Could not submit review' });
    }
};
