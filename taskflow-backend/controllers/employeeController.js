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
const Department = require('../models/Department');
const TeamMeeting = require('../models/TeamMeeting');
const logActivity = require('../activityLogger');

/* ==========================================================================
   1.1 EMPLOYEE DASHBOARD
   ========================================================================== */

exports.getDashboard = async (req, res) => {
    try {
        const userId = req.userId;
        const now = new Date();
        const todayKey = now.toISOString().slice(0, 10);
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        // Fetch User with Manager and Department
        const user = await User.findById(userId)
            .select('-password')
            .populate('manager', 'name email designation phone profilePicture')
            .lean();

        if (!user) return res.status(404).json({ message: 'User not found' });

        // Department Info
        const department = user.department
            ? await Department.findOne({
                name: { $regex: `^${String(user.department).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
            }).select('name code head').populate('head', 'name email').lean()
            : null;

        // Tasks assigned to employee
        const tasks = await Task.find({ user: userId })
            .populate('assignedBy', 'name email designation')
            .sort({ deadline: 1, createdAt: -1 })
            .lean();

        // Project names from user's tasks + projects where assigned
        const distinctProjectNames = [...new Set(tasks.map(t => t.project).filter(Boolean))];
        const projects = await Project.find({
            $or: [
                { assignedEmployees: userId },
                { teamLead: userId },
                { name: { $in: distinctProjectNames } }
            ]
        }).populate('department', 'name code').populate('teamLead', 'name').lean();

        // Attendance & Leave for today
        const todayDateObj = new Date(todayKey + 'T12:00:00.000Z');
        const [todayAttendance, todayLeave, recentAttendance] = await Promise.all([
            Attendance.findOne({ user: userId, date: todayKey }).lean(),
            LeaveRequest.findOne({
                user: userId,
                status: 'approved',
                $or: [
                    { startDate: { $lte: todayEnd }, endDate: { $gte: todayStart } },
                    { startDate: { $lte: todayDateObj }, endDate: { $gte: todayDateObj } }
                ]
            }).lean(),
            Attendance.find({ user: userId }).sort({ date: -1 }).limit(14).lean(),
        ]);

        const isOnLeave = Boolean(
            todayLeave ||
            todayAttendance?.status === 'on-leave'
        );

        let todayStatus = 'Absent';
        if (isOnLeave) {
            todayStatus = 'On Leave';
        } else if (todayAttendance?.clockIn) {
            const clockInHour = new Date(todayAttendance.clockIn).getHours();
            todayStatus = clockInHour >= 9 ? 'Late' : 'Present';
        }

        // Task Stats Breakdown
        const completedTasks = tasks.filter(t => t.status === 'completed');
        const inProgressTasks = tasks.filter(t => t.status === 'in-process');
        const inReviewTasks = tasks.filter(t => t.status === 'in-review');
        const pendingTasks = tasks.filter(t => t.status === 'pending');
        const overdueTasks = tasks.filter(t => t.status !== 'completed' && t.deadline && new Date(t.deadline) < now);

        const totalTasks = tasks.length;
        const completionRate = totalTasks ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

        // Tasks requiring modifications (manager requested changes, active only if not completed/resubmitted)
        const tasksRequiringModifications = tasks.filter(t =>
            t.status !== 'completed' &&
            t.status !== 'in-review' &&
            t.reviewStatus === 'changes-requested'
        );

        // Upcoming Deadlines (Projects & Tasks)
        const upcomingDeadlines = [
            ...tasks.filter(t => t.deadline && t.status !== 'completed' && new Date(t.deadline) >= todayStart).map(t => ({
                id: t._id,
                type: 'task',
                title: t.title,
                project: t.project,
                priority: t.priority,
                deadline: t.deadline,
                isOverdue: new Date(t.deadline) < now,
                daysRemaining: Math.ceil((new Date(t.deadline) - now) / (1000 * 60 * 60 * 24)),
            })),
            ...projects.filter(p => p.deadline && p.status !== 'Completed' && new Date(p.deadline) >= todayStart).map(p => ({
                id: p._id,
                type: 'project',
                title: p.name,
                priority: p.priority,
                deadline: p.deadline,
                isOverdue: new Date(p.deadline) < now,
                daysRemaining: Math.ceil((new Date(p.deadline) - now) / (1000 * 60 * 60 * 24)),
            }))
        ].sort((a, b) => new Date(a.deadline) - new Date(b.deadline)).slice(0, 10);

        // Project-wise progress and individual contributions
        const projectContributions = projects.map(project => {
            const projectTasks = tasks.filter(t => String(t.project || '').toLowerCase() === project.name.toLowerCase());
            const projectCompleted = projectTasks.filter(t => t.status === 'completed').length;
            const projectOverdue = projectTasks.filter(t => t.status !== 'completed' && t.deadline && new Date(t.deadline) < now).length;

            return {
                id: project._id,
                name: project.name,
                status: project.status,
                priority: project.priority,
                deadline: project.deadline,
                progress: project.progress || 0,
                assignedTasksCount: projectTasks.length,
                completedTasksCount: projectCompleted,
                overdueTasksCount: projectOverdue,
                myContributionRate: projectTasks.length ? Math.round((projectCompleted / projectTasks.length) * 100) : 0,
            };
        });

        // Announcements (department scope or all)
        const announcements = await Announcement.find({
            $or: [
                { audience: 'all' },
                ...(department ? [{ audience: 'department', department: department._id }] : [])
            ]
        }).populate('publishedBy', 'name role').sort({ publishedAt: -1 }).limit(8).lean();

        // Recent feedback from manager
        const recentFeedback = await EmployeeFeedback.find({ employee: userId })
            .populate('manager', 'name email designation')
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        // Recent Activities
        const recentActivities = await Activity.find({
            $or: [
                { actor: userId },
                { details: { $regex: user.name, $options: 'i' } }
            ]
        }).sort({ createdAt: -1 }).limit(10).lean();

        // Upcoming Meetings & Events
        const upcomingMeetings = await TeamMeeting.find({
            $or: [
                { attendees: userId },
                { team: user.team },
                ...(department ? [{ department: department._id }] : [])
            ],
            startTime: { $gte: todayStart }
        }).populate('organizer', 'name email designation').sort({ startTime: 1 }).limit(6).lean();

        return res.json({
            user: {
                ...user,
                departmentInfo: department,
            },
            stats: {
                totalProjects: projects.length,
                totalTasks,
                pendingTasks: pendingTasks.length,
                inProgressTasks: inProgressTasks.length,
                inReviewTasks: inReviewTasks.length,
                completedTasks: completedTasks.length,
                overdueTasks: overdueTasks.length,
                completionRate,
            },
            todayAttendance: {
                status: todayStatus,
                clockIn: todayAttendance?.clockIn || null,
                clockOut: todayAttendance?.clockOut || null,
                totalSeconds: todayAttendance?.totalSeconds || 0,
                leaveReason: todayLeave?.reason || null,
                isOnLeave,
                leaveDetails: todayLeave ? {
                    _id: todayLeave._id,
                    leaveType: todayLeave.leaveType,
                    startDate: todayLeave.startDate,
                    endDate: todayLeave.endDate,
                    totalDays: todayLeave.totalDays,
                    reason: todayLeave.reason,
                    approvedAt: todayLeave.approvedAt,
                } : (todayAttendance?.status === 'on-leave' ? {
                    leaveType: 'Approved Leave',
                    startDate: todayKey,
                    endDate: todayKey,
                    totalDays: 1,
                    reason: 'Approved Leave of Absence',
                } : null),
            },
            upcomingDeadlines,
            projectContributions,
            tasksRequiringModifications,
            recentFeedback,
            announcements,
            upcomingMeetings,
            recentActivities,
            recentAttendance,
        });
    } catch (error) {
        console.error('Employee dashboard error:', error);
        return res.status(500).json({ message: 'Could not load employee dashboard data' });
    }
};

/* ==========================================================================
   1.2 MY PROFILE & DEPARTMENT INFORMATION
   ========================================================================== */

exports.getProfile = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId)
            .select('-password')
            .populate('manager', 'name email designation phone employeeId profilePicture')
            .lean();

        if (!user) return res.status(404).json({ message: 'Employee not found' });

        // Department Details
        const department = user.department
            ? await Department.findOne({
                name: { $regex: `^${String(user.department).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
            }).populate('head', 'name email designation').lean()
            : null;

        // Team members (colleagues in same team)
        const teamFilter = {
            _id: { $ne: userId },
            role: 'Employee',
            isActive: { $ne: false },
        };
        if (user.team) teamFilter.team = user.team;
        else if (user.department) teamFilter.department = user.department;

        const teamMembers = await User.find(teamFilter)
            .select('name firstName lastName employeeId designation team department email profilePicture')
            .lean();

        // Profile change requests submitted by this employee
        const changeRequests = await ProfileChangeRequest.find({ user: userId })
            .sort({ createdAt: -1 })
            .lean();

        return res.json({
            user,
            department,
            teamMembers,
            changeRequests,
            employmentStatus: user.isSuspended ? 'Suspended' : user.isActive === false ? 'Inactive' : 'Active',
        });
    } catch (error) {
        return res.status(500).json({ message: 'Could not load profile information' });
    }
};

exports.updatePermittedProfile = async (req, res) => {
    try {
        const userId = req.userId;
        const updates = {};
        if (req.body.phone !== undefined) updates.phone = String(req.body.phone).trim();
        if (req.body.firstName !== undefined) updates.firstName = String(req.body.firstName).trim();
        if (req.body.lastName !== undefined) updates.lastName = String(req.body.lastName).trim();

        if (updates.firstName !== undefined || updates.lastName !== undefined) {
            const current = await User.findById(userId).select('firstName lastName name');
            if (!current) return res.status(404).json({ message: 'User not found' });
            updates.name = [updates.firstName ?? current.firstName, updates.lastName ?? current.lastName].filter(Boolean).join(' ').trim() || current.name;
        }

        const user = await User.findByIdAndUpdate(userId, updates, { new: true, runValidators: true }).select('-password');
        logActivity(userId, 'updated permitted personal info', 'profile', user.name);
        return res.json(user);
    } catch (error) {
        return res.status(500).json({ message: 'Could not update profile' });
    }
};

exports.changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || String(newPassword).length < 8) {
        return res.status(400).json({ message: 'Current password and a new password with at least 8 characters are required' });
    }
    try {
        const user = await User.findById(req.userId);
        if (!user || !await bcrypt.compare(currentPassword, user.password)) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }
        user.password = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
        await user.save();
        logActivity(req.userId, 'changed account password', 'security', user.name);
        return res.json({ message: 'Password changed successfully' });
    } catch (error) {
        return res.status(500).json({ message: 'Could not change password' });
    }
};

exports.requestProfileChange = async (req, res) => {
    const allowedFields = ['department', 'designation', 'employeeId', 'team', 'manager', 'joiningDate'];
    const { field, requestedValue, reason } = req.body;

    if (!allowedFields.includes(field) || !String(requestedValue || '').trim()) {
        return res.status(400).json({ message: 'Select a restricted field and provide requested value' });
    }

    try {
        const user = await User.findById(req.userId).select(field);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const pending = await ProfileChangeRequest.findOne({ user: req.userId, field, status: 'pending' });
        if (pending) {
            return res.status(409).json({ message: 'A request for this field is already pending Admin review' });
        }

        const request = await ProfileChangeRequest.create({
            user: req.userId,
            field,
            currentValue: user[field] == null ? '' : String(user[field]),
            requestedValue: String(requestedValue).trim(),
            reason: reason || '',
        });

        logActivity(req.userId, 'submitted profile change request', 'profile change', field);
        return res.status(201).json(request);
    } catch (error) {
        return res.status(500).json({ message: 'Could not submit change request' });
    }
};

/* ==========================================================================
   1.3 MY PROJECTS
   ========================================================================== */

exports.getMyProjects = async (req, res) => {
    try {
        const userId = req.userId;
        const now = new Date();

        // Find tasks for this employee to get project names
        const employeeTasks = await Task.find({ user: userId }).select('project status deadline priority').lean();
        const distinctProjectNames = [...new Set(employeeTasks.map(t => t.project).filter(Boolean))];

        const projects = await Project.find({
            $or: [
                { assignedEmployees: userId },
                { teamLead: userId },
                { name: { $in: distinctProjectNames } }
            ]
        })
        .populate('department', 'name code')
        .populate('manager', 'name email designation')
        .populate('teamLead', 'name email designation employeeId')
        .populate('assignedEmployees', 'name email designation team employeeId')
        .sort({ deadline: 1, createdAt: -1 })
        .lean();

        const enriched = projects.map(proj => {
            const userProjTasks = employeeTasks.filter(t => String(t.project || '').toLowerCase() === proj.name.toLowerCase());
            const userCompleted = userProjTasks.filter(t => t.status === 'completed').length;
            const userOverdue = userProjTasks.filter(t => t.status !== 'completed' && t.deadline && new Date(t.deadline) < now).length;
            const isOverdue = proj.deadline && new Date(proj.deadline) < now && proj.status !== 'Completed';
            const daysRemaining = proj.deadline ? Math.ceil((new Date(proj.deadline) - now) / (1000 * 60 * 60 * 24)) : null;

            return {
                ...proj,
                myTasksCount: userProjTasks.length,
                myCompletedTasks: userCompleted,
                myOverdueTasks: userOverdue,
                myContributionPercentage: userProjTasks.length ? Math.round((userCompleted / userProjTasks.length) * 100) : 0,
                isOverdue,
                daysRemaining,
                milestonesCount: (proj.milestones || []).length,
                completedMilestones: (proj.milestones || []).filter(m => m.completed).length,
                documentsCount: (proj.documents || []).length,
                commentsCount: (proj.comments || []).length,
            };
        });

        return res.json(enriched);
    } catch (error) {
        console.error('getMyProjects error:', error);
        return res.status(500).json({ message: 'Could not load your projects' });
    }
};

exports.getProjectDetails = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        const project = await Project.findById(id)
            .populate('department', 'name code')
            .populate('manager', 'name email designation phone')
            .populate('teamLead', 'name email designation employeeId')
            .populate('assignedEmployees', 'name email designation team employeeId')
            .populate('documents.uploadedBy', 'name email')
            .populate('comments.user', 'name role designation')
            .lean();

        if (!project) return res.status(404).json({ message: 'Project not found' });

        // Tasks associated with this project that belong to this employee
        const myTasks = await Task.find({ project: project.name, user: userId })
            .sort({ deadline: 1 })
            .lean();

        const now = new Date();
        const completedCount = myTasks.filter(t => t.status === 'completed').length;
        const overdueCount = myTasks.filter(t => t.status !== 'completed' && t.deadline && new Date(t.deadline) < now).length;

        const isOverdue = project.deadline && new Date(project.deadline) < now && project.status !== 'Completed';
        const daysRemaining = project.deadline ? Math.ceil((new Date(project.deadline) - now) / (1000 * 60 * 60 * 24)) : null;

        return res.json({
            project: {
                ...project,
                isOverdue,
                daysRemaining,
            },
            myTasks,
            myStats: {
                totalTasks: myTasks.length,
                completed: completedCount,
                overdue: overdueCount,
                contributionPercentage: myTasks.length ? Math.round((completedCount / myTasks.length) * 100) : 0,
            },
        });
    } catch (error) {
        return res.status(500).json({ message: 'Could not load project details' });
    }
};

exports.uploadProjectDocument = async (req, res) => {
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

exports.addProjectComment = async (req, res) => {
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
        logActivity(req.userId, 'posted update on project', 'project', project.name);
        const populated = await Project.findById(project._id).populate('comments.user', 'name role designation');
        return res.status(201).json(populated.comments);
    } catch (error) {
        return res.status(500).json({ message: 'Could not add comment' });
    }
};

/* ==========================================================================
   1.4 MY TASKS
   ========================================================================= */

exports.getMyTasks = async (req, res) => {
    try {
        const userId = req.userId;
        const now = new Date();

        const tasks = await Task.find({ user: userId })
            .populate('assignedBy', 'name email designation')
            .populate('comments.user', 'name role')
            .populate('managerFeedback.manager', 'name email designation')
            .sort({ deadline: 1, createdAt: -1 })
            .lean();

        const enrichedTasks = tasks.map(task => {
            const isOverdue = task.status !== 'completed' && task.deadline && new Date(task.deadline) < now;
            const daysRemaining = task.deadline ? Math.ceil((new Date(task.deadline) - now) / (1000 * 60 * 60 * 24)) : null;

            return {
                ...task,
                isOverdue,
                daysRemaining,
                hasFeedback: (task.managerFeedback || []).length > 0,
                needsModification: task.status !== 'completed' && task.status !== 'in-review' && task.reviewStatus === 'changes-requested',
            };
        });

        return res.json(enrichedTasks);
    } catch (error) {
        console.error('getMyTasks error:', error);
        return res.status(500).json({ message: 'Could not load your tasks' });
    }
};

exports.getTaskDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const task = await Task.findOne({ _id: id, user: req.userId })
            .populate('assignedBy', 'name email designation')
            .populate('comments.user', 'name role designation')
            .populate('attachments.user', 'name')
            .populate('managerFeedback.manager', 'name email designation')
            .populate('history.performedBy', 'name role')
            .lean();

        if (!task) return res.status(404).json({ message: 'Task not found' });

        const now = new Date();
        const isOverdue = task.status !== 'completed' && task.deadline && new Date(task.deadline) < now;
        const daysRemaining = task.deadline ? Math.ceil((new Date(task.deadline) - now) / (1000 * 60 * 60 * 24)) : null;

        return res.json({
            ...task,
            isOverdue,
            daysRemaining,
            needsModification: task.status !== 'completed' && task.status !== 'in-review' && task.reviewStatus === 'changes-requested',
        });
    } catch (error) {
        return res.status(500).json({ message: 'Could not load task details' });
    }
};

exports.updateTaskStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const allowedStatuses = ['pending', 'in-process', 'in-review', 'completed'];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const task = await Task.findOne({ _id: id, user: req.userId });
        if (!task) return res.status(404).json({ message: 'Task not found' });

        const prevStatus = task.status;
        task.status = status;
        if (status === 'completed' && task.reviewStatus === 'changes-requested') {
            task.reviewStatus = 'approved';
        } else if (status === 'in-review' && task.reviewStatus === 'changes-requested') {
            task.reviewStatus = 'submitted';
        }
        task.history.push({
            action: `Status changed from ${prevStatus} to ${status}`,
            performedBy: req.userId,
            details: `Employee updated task status`,
            createdAt: new Date(),
        });

        await task.save();
        logActivity(req.userId, 'updated task status', 'task', task.title, `Changed to ${status}`);
        return res.json(task);
    } catch (error) {
        return res.status(500).json({ message: 'Could not update task status' });
    }
};

exports.submitTaskForReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { submissionNotes } = req.body;

        const task = await Task.findOne({ _id: id, user: req.userId });
        if (!task) return res.status(404).json({ message: 'Task not found' });

        task.status = 'in-review';
        task.reviewStatus = 'submitted';
        task.submissionNotes = String(submissionNotes || '').trim();
        task.submittedAt = new Date();

        task.history.push({
            action: 'Submitted task for manager review',
            performedBy: req.userId,
            details: submissionNotes || 'Completed work submitted for verification',
            createdAt: new Date(),
        });

        await task.save();
        logActivity(req.userId, 'submitted task for review', 'task', task.title);
        return res.json({ message: 'Task submitted for manager review', task });
    } catch (error) {
        return res.status(500).json({ message: 'Could not submit task for review' });
    }
};

exports.resubmitTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { submissionNotes } = req.body;

        const task = await Task.findOne({ _id: id, user: req.userId });
        if (!task) return res.status(404).json({ message: 'Task not found' });

        task.status = 'in-review';
        task.reviewStatus = 'submitted';
        task.submissionNotes = String(submissionNotes || '').trim();
        task.submittedAt = new Date();

        task.history.push({
            action: 'Resubmitted task with modifications',
            performedBy: req.userId,
            details: submissionNotes || 'Updated work resubmitted after changes requested',
            createdAt: new Date(),
        });

        await task.save();
        logActivity(req.userId, 'resubmitted modified task', 'task', task.title);
        return res.json({ message: 'Task resubmitted successfully', task });
    } catch (error) {
        return res.status(500).json({ message: 'Could not resubmit task' });
    }
};

exports.addTaskProgressUpdate = async (req, res) => {
    try {
        const { id } = req.params;
        const { text, progress } = req.body;
        if (!text || !String(text).trim()) return res.status(400).json({ message: 'Update text is required' });

        const task = await Task.findOne({ _id: id, user: req.userId });
        if (!task) return res.status(404).json({ message: 'Task not found' });

        task.progressUpdates.push({
            text: String(text).trim(),
            progress: Number(progress) || 0,
            createdAt: new Date(),
        });

        task.history.push({
            action: 'Added progress update',
            performedBy: req.userId,
            details: `${text} (${progress || 0}%)`,
            createdAt: new Date(),
        });

        await task.save();
        return res.json(task.progressUpdates);
    } catch (error) {
        return res.status(500).json({ message: 'Could not add progress update' });
    }
};

exports.getUpcomingMeetings = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findById(userId).select('department team');
        const department = user?.department
            ? await Department.findOne({ name: { $regex: `^${String(user.department).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }).select('_id')
            : null;

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const meetings = await TeamMeeting.find({
            $or: [
                { attendees: userId },
                { team: user?.team },
                ...(department ? [{ department: department._id }] : [])
            ],
            startTime: { $gte: now }
        }).populate('organizer', 'name email designation').sort({ startTime: 1 }).limit(10).lean();

        return res.json(meetings);
    } catch (error) {
        return res.status(500).json({ message: 'Could not load meetings' });
    }
};
