const User = require('../models/User');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Task = require('../models/Task');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const FocusSession = require('../models/FocusSession');
const Department = require('../models/Department');
const logActivity = require('../activityLogger');
const { sendEmployeeCredentialsEmail } = require('../config/email');

const profilePicturesDirectory = path.join(__dirname, '..', 'uploads', 'profile-pictures');

// Ensure directory exists
if (!fs.existsSync(profilePicturesDirectory)) {
    try {
        fs.mkdirSync(profilePicturesDirectory, { recursive: true });
    } catch (err) {
        console.error('Could not create profile pictures directory:', err.message);
    }
}

/**
 * Validates account creation payload for both Employee and Manager roles.
 */
const validateAccountPayload = (data) => {
    const errors = {};
    const email = String(data.email || '').trim().toLowerCase();
    const employeeId = String(data.employeeId || '').trim().toUpperCase();
    const firstName = String(data.firstName || '').trim();
    const lastName = String(data.lastName || '').trim();
    const phone = String(data.phone || '').trim();
    const role = data.role === 'Manager' ? 'Manager' : (data.role === 'Admin' ? 'Admin' : 'Employee');
    const department = String(data.department || '').trim();
    const designation = String(data.designation || '').trim();
    const joiningDate = data.joiningDate;

    // Names
    if (!firstName || firstName.length < 2) {
        errors.firstName = 'First name must be at least 2 characters.';
    } else if (!/^[a-zA-Z\s'-]+$/.test(firstName)) {
        errors.firstName = 'First name can only contain letters, spaces, or hyphens.';
    }
    if (lastName && !/^[a-zA-Z\s'-]+$/.test(lastName)) {
        errors.lastName = 'Last name can only contain letters, spaces, or hyphens.';
    }

    // Email
    if (!email) {
        errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.email = 'Please provide a valid email address format.';
    }

    // Profile ID
    if (!employeeId) {
        errors.employeeId = `${role === 'Manager' ? 'Manager' : 'Employee'} ID is required.`;
    } else if (!/^[A-Za-z0-9-]{3,24}$/.test(employeeId)) {
        errors.employeeId = 'Profile ID must be 3 to 24 alphanumeric characters or hyphens (e.g. EMP-101, MGR-201).';
    }

    // Phone
    if (!phone) {
        errors.phone = 'Phone number is required.';
    } else if (!/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{7,15}$/.test(phone)) {
        errors.phone = 'Please provide a valid phone number (minimum 7 digits).';
    }

    // Department
    if (!department) {
        errors.department = 'Department is required.';
    }

    // Designation
    if (!designation) {
        errors.designation = 'Designation is required.';
    }

    // Role-specific checks
    if (role === 'Employee') {
        if (!data.team) {
            errors.team = 'Assigned team is required for employee accounts.';
        }
        if (!data.manager) {
            errors.manager = 'Reporting manager is required for employee accounts.';
        }
    }

    // Joining Date
    if (!joiningDate) {
        errors.joiningDate = 'Joining date is required.';
    } else if (isNaN(new Date(joiningDate).getTime())) {
        errors.joiningDate = 'Please select a valid joining date.';
    }

    // Password if manually provided
    if (data.passwordMode === 'manual' && data.manualPassword) {
        if (data.manualPassword.length < 6) {
            errors.manualPassword = 'Password must be at least 6 characters.';
        }
    }

    return { errors, isValid: Object.keys(errors).length === 0 };
};

/**
 * Internal account creation logic supporting Employee and Manager accounts.
 */
const createAccount = async (data, actorId) => {
    const { errors, isValid } = validateAccountPayload(data);
    if (!isValid) {
        const errorMsg = Object.values(errors).join(' ');
        throw Object.assign(new Error(errorMsg), { status: 400, validationErrors: errors });
    }

    const email = String(data.email || '').trim().toLowerCase();
    const employeeId = String(data.employeeId || '').trim().toUpperCase();
    const firstName = String(data.firstName || '').trim();
    const lastName = String(data.lastName || '').trim();
    const name = [firstName, lastName].filter(Boolean).join(' ') || String(data.name || '').trim();
    const role = data.role === 'Manager' ? 'Manager' : (data.role === 'Admin' ? 'Admin' : 'Employee');

    // Duplicate check
    const duplicate = await User.findOne({
        $or: [
            { email },
            { employeeId },
        ],
    }).select('email employeeId');

    if (duplicate) {
        if (duplicate.email === email) {
            throw Object.assign(new Error(`An account with email "${email}" is already registered.`), { status: 409 });
        }
        if (duplicate.employeeId === employeeId) {
            throw Object.assign(new Error(`Profile ID "${employeeId}" is already registered to another account.`), { status: 409 });
        }
    }

    // Verify reporting manager if assigned
    if (role === 'Employee' && data.manager) {
        const reportingMgr = await User.findById(data.manager).select('role isActive isSuspended department');
        if (!reportingMgr || (reportingMgr.role !== 'Manager' && reportingMgr.role !== 'Admin')) {
            throw Object.assign(new Error('Selected reporting manager must be an authorized Manager or Admin.'), { status: 400 });
        }
        if (reportingMgr.isActive === false || reportingMgr.isSuspended) {
            throw Object.assign(new Error('Selected reporting manager account is currently deactivated or suspended.'), { status: 400 });
        }
    }

    // Password generation / hashing
    let passwordForEmail = '';
    if (data.passwordMode === 'manual' && data.manualPassword) {
        passwordForEmail = String(data.manualPassword).trim();
    } else {
        passwordForEmail = crypto.randomBytes(9).toString('base64url');
    }

    const hashedPassword = await bcrypt.hash(passwordForEmail, await bcrypt.genSalt(10));

    // Normalize teams array for managers
    let assignedTeams = [];
    if (Array.isArray(data.teams)) {
        assignedTeams = data.teams.filter(Boolean);
    } else if (typeof data.teams === 'string' && data.teams.trim()) {
        assignedTeams = data.teams.split(',').map((t) => t.trim()).filter(Boolean);
    } else if (data.team) {
        assignedTeams = [data.team.trim()];
    }

    const user = await User.create({
        name,
        firstName,
        lastName,
        email,
        phone: data.phone || '',
        employeeId,
        password: hashedPassword,
        role,
        department: data.department || 'General',
        departmentHistory: [{
            fromDepartment: '',
            toDepartment: data.department || 'General',
            changedBy: actorId,
            changedAt: new Date(),
        }],
        designation: data.designation || '',
        responsibilities: data.responsibilities || '',
        team: role === 'Employee' ? (data.team || '') : (assignedTeams[0] || ''),
        teams: assignedTeams,
        employmentType: data.employmentType || 'Full-time',
        employmentStatus: data.employmentStatus || 'Active',
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        joiningDate: data.joiningDate ? new Date(data.joiningDate) : null,
        manager: role === 'Employee' ? (data.manager || null) : null,
        isActive: data.isActive !== false,
        isSuspended: data.isSuspended === true,
    });

    let credentialsSent = true;
    try {
        await sendEmployeeCredentialsEmail(user, passwordForEmail);
    } catch (emailError) {
        credentialsSent = false;
        console.error('Credentials email could not be sent:', emailError.message);
    }

    user.credentialsSent = credentialsSent;
    await user.save();

    logActivity(actorId, `created ${role.toLowerCase()} account`, role.toLowerCase(), user.name);

    return { user, credentialsSent, temporaryPassword: passwordForEmail };
};

// Create user (Admin only)
exports.createUser = async (req, res) => {
    try {
        if (req.userRole !== 'Admin') return res.status(403).json({ message: 'Access denied: Admin authority required.' });
        
        const { user, credentialsSent } = await createAccount(req.body, req.userId);
        return res.status(201).json({
            user: await User.findById(user._id).select('-password').populate('manager', 'name email designation'),
            credentialsSent,
            message: credentialsSent
                ? `${user.role} account created and login credentials emailed successfully.`
                : `${user.role} account created, but login credentials could not be emailed. Please check SMTP configuration or resend credentials.`,
        });
    } catch (err) {
        res.status(err.status || (err.code === 11000 ? 409 : 500)).json({
            message: err.code === 11000 ? 'Email or Profile ID already exists' : err.message,
            errors: err.validationErrors || undefined,
        });
    }
};

// Update user (Admin only)
exports.updateUser = async (req, res) => {
    try {
        if (req.userRole !== 'Admin') return res.status(403).json({ message: 'Access denied: Admin authority required.' });
        
        const allowedFields = [
            'email', 'password', 'role', 'department', 'manager', 'isActive',
            'isSuspended', 'firstName', 'lastName', 'phone', 'employeeId',
            'designation', 'responsibilities', 'team', 'teams', 'joiningDate',
            'employmentType', 'employmentStatus', 'dateOfBirth'
        ];

        const updates = {};
        allowedFields.forEach((field) => {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) updates[field] = req.body[field];
        });

        if (updates.email) updates.email = String(updates.email).trim().toLowerCase();
        if (updates.employeeId !== undefined) {
            updates.employeeId = String(updates.employeeId).trim().toUpperCase();
            if (!updates.employeeId) delete updates.employeeId;
        }

        // Duplicate checks
        if (updates.employeeId || updates.email) {
            const duplicate = await User.findOne({
                _id: { $ne: req.params.id },
                $or: [
                    ...(updates.email ? [{ email: updates.email }] : []),
                    ...(updates.employeeId ? [{ employeeId: updates.employeeId }] : []),
                ],
            }).select('email employeeId');

            if (duplicate) {
                return res.status(409).json({
                    message: duplicate.email === updates.email
                        ? `An account with email "${updates.email}" already exists.`
                        : `Profile ID "${updates.employeeId}" is already registered to another user.`
                });
            }
        }

        // Name computation
        if (updates.firstName !== undefined || updates.lastName !== undefined) {
            const existing = await User.findById(req.params.id).select('firstName lastName name');
            if (!existing) return res.status(404).json({ message: 'User not found' });
            updates.name = [updates.firstName ?? existing.firstName, updates.lastName ?? existing.lastName].filter(Boolean).join(' ').trim() || existing.name;
        }

        // Department transition logging
        if (updates.department !== undefined) {
            updates.department = String(updates.department || '').trim() || 'General';
            const existing = await User.findById(req.params.id).select('department departmentHistory');
            if (!existing) return res.status(404).json({ message: 'User not found' });
            const previousDepartment = String(existing.department || 'General').trim();
            if (previousDepartment.toLowerCase() !== updates.department.toLowerCase()) {
                updates.departmentHistory = [
                    ...(existing.departmentHistory || []),
                    {
                        fromDepartment: previousDepartment,
                        toDepartment: updates.department,
                        changedBy: req.userId,
                        changedAt: new Date(),
                    },
                ];
            }
        }

        // Password update
        if (updates.password) {
            if (updates.password.length < 6) {
                return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
            }
            const salt = await bcrypt.genSalt(10);
            updates.password = await bcrypt.hash(updates.password, salt);
        }

        // Normalize teams
        if (updates.teams && !Array.isArray(updates.teams)) {
            if (typeof updates.teams === 'string') {
                updates.teams = updates.teams.split(',').map((t) => t.trim()).filter(Boolean);
            }
        }

        const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
            .select('-password')
            .populate('manager', 'name email designation');

        if (!user) return res.status(404).json({ message: 'User not found' });

        const activityAction = updates.isSuspended
            ? 'suspended user'
            : updates.isActive === false
                ? 'deactivated user'
                : updates.isActive === true
                    ? 'activated user'
                    : 'updated user profile';

        logActivity(req.userId, activityAction, user.role.toLowerCase(), user.name);

        res.json(user);
    } catch (err) {
        res.status(err.status || (err.code === 11000 ? 409 : 500)).json({
            message: err.code === 11000 ? 'Email or Profile ID already exists' : err.message
        });
    }
};

exports.importUsers = async (req, res) => {
    if (req.userRole !== 'Admin') return res.status(403).json({ message: 'Access denied: Admin authority required.' });
    const rows = req.body.users;
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 200) {
        return res.status(400).json({ message: 'Upload a file containing 1 to 200 account rows.' });
    }
    const created = [];
    const failed = [];
    for (let index = 0; index < rows.length; index += 1) {
        try {
            const result = await createAccount(rows[index], req.userId);
            created.push({ row: index + 2, name: result.user.name, email: result.user.email, credentialsSent: result.credentialsSent });
        } catch (error) {
            failed.push({ row: index + 2, email: String(rows[index].email || ''), message: error.message });
        }
    }
    return res.status(200).json({ created, failed });
};

exports.getUserProfile = async (req, res) => {
    if (req.userRole !== 'Admin') return res.status(403).json({ message: 'Access denied: Admin authority required.' });
    try {
        const [user, tasks, attendance, leaveHistory, focusSessions] = await Promise.all([
            User.findById(req.params.id).select('-password').populate('manager', 'name email designation'),
            Task.find({ user: req.params.id }).select('title project status priority deadline createdAt updatedAt'),
            Attendance.find({ user: req.params.id }).sort({ date: -1 }).limit(90),
            LeaveRequest.find({ user: req.params.id }).sort({ createdAt: -1 }).limit(30),
            FocusSession.find({ user: req.params.id }).select('durationSeconds startTime').limit(100),
        ]);
        if (!user) return res.status(404).json({ message: 'User not found' });
        const completedTasks = tasks.filter((task) => task.status === 'completed').length;
        return res.json({
            user,
            tasks,
            attendance,
            leaveHistory,
            performance: {
                totalTasks: tasks.length,
                completedTasks,
                completionRate: tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0,
                focusMinutes: Math.round(focusSessions.reduce((total, session) => total + session.durationSeconds, 0) / 60),
            },
        });
    } catch (error) {
        return res.status(500).json({ message: 'Could not load profile details.' });
    }
};

exports.uploadProfilePicture = async (req, res) => {
    const isSelf = String(req.userId) === String(req.params.id);
    if (req.userRole !== 'Admin' && !isSelf) {
        if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(403).json({ message: 'Access denied: You can only update your own profile picture.' });
    }
    if (!req.file) return res.status(400).json({ message: 'Choose an image file to upload.' });
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            await fs.promises.unlink(req.file.path).catch(() => {});
            return res.status(404).json({ message: 'User not found.' });
        }
        if (user.profilePicture) {
            await fs.promises.unlink(path.join(profilePicturesDirectory, path.basename(user.profilePicture))).catch(() => {});
        }
        user.profilePicture = req.file.filename;
        await user.save();
        return res.json({ profilePicture: user.profilePicture, message: 'Profile picture updated successfully.' });
    } catch (error) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(500).json({ message: 'Could not save profile picture.' });
    }
};

exports.deleteProfilePicture = async (req, res) => {
    const isSelf = String(req.userId) === String(req.params.id);
    if (req.userRole !== 'Admin' && !isSelf) {
        return res.status(403).json({ message: 'Access denied: You can only remove your own profile picture.' });
    }
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found.' });
        if (user.profilePicture) {
            await fs.promises.unlink(path.join(profilePicturesDirectory, path.basename(user.profilePicture))).catch(() => {});
            user.profilePicture = null;
            await user.save();
        }
        return res.json({ profilePicture: null, message: 'Profile picture removed successfully.' });
    } catch (error) {
        return res.status(500).json({ message: 'Could not remove profile picture.' });
    }
};

exports.resendCredentials = async (req, res) => {
    if (req.userRole !== 'Admin') return res.status(403).json({ message: 'Access denied: Admin authority required.' });
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return res.status(503).json({ message: 'SMTP is not configured; credentials cannot be emailed.' });
    }
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found.' });
        const temporaryPassword = crypto.randomBytes(9).toString('base64url');
        user.password = await bcrypt.hash(temporaryPassword, await bcrypt.genSalt(10));
        user.credentialsSent = false;
        await user.save();
        await sendEmployeeCredentialsEmail(user, temporaryPassword);
        user.credentialsSent = true;
        await user.save();
        return res.json({ message: `New login credentials were emailed successfully to ${user.email}.` });
    } catch (error) {
        console.error('Credential resend failed:', error.message);
        return res.status(503).json({ message: 'Could not email new credentials. Check SMTP configuration.' });
    }
};

exports.getProfilePicture = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('profilePicture');
        if (!user?.profilePicture) return res.status(404).json({ message: 'Profile picture not found.' });
        const filePath = path.join(profilePicturesDirectory, path.basename(user.profilePicture));
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'Profile picture file not found on disk.' });
        }
        return res.sendFile(filePath);
    } catch (error) {
        return res.status(500).json({ message: 'Could not load profile picture.' });
    }
};

// Soft deactivation / Delete user (Admin only)
exports.deleteUser = async (req, res) => {
    try {
        if (req.userRole !== 'Admin') return res.status(403).json({ message: 'Access denied: Admin authority required.' });
        
        // Check if query specifies hard delete, otherwise perform safe soft-deactivation
        const isPermanent = req.query.permanent === 'true';
        if (!isPermanent) {
            const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true }).select('-password');
            if (!user) return res.status(404).json({ message: 'User not found.' });
            logActivity(req.userId, 'deactivated user account', user.role.toLowerCase(), user.name);
            return res.json({ message: `Account for ${user.name} has been deactivated. Historical records and task histories are preserved.` });
        }

        const user = await User.findByIdAndDelete(req.params.id);
        if (user?.profilePicture) {
            await fs.promises.unlink(path.join(profilePicturesDirectory, path.basename(user.profilePicture))).catch(() => {});
        }
        if (user) logActivity(req.userId, 'permanently deleted user account', user.role.toLowerCase(), user.name);
        res.json({ message: 'User permanently deleted.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get all users (Admin only) with subordinate count calculation for managers
exports.getAllUsers = async (req, res) => {
    try {
        if (req.userRole !== 'Admin') return res.status(403).json({ message: 'Access denied: Admin authority required.' });
        
        const [users, directReportsAgg] = await Promise.all([
            User.find().select('-password').populate('manager', 'name email designation employeeId').sort({ createdAt: -1 }),
            User.aggregate([
                { $match: { manager: { $ne: null } } },
                { $group: { _id: '$manager', total: { $sum: 1 } } },
            ]),
        ]);

        const directReportsMap = {};
        directReportsAgg.forEach((item) => {
            if (item._id) directReportsMap[String(item._id)] = item.total;
        });

        const enhancedUsers = users.map((u) => {
            const doc = u.toObject();
            if (u.role === 'Manager') {
                doc.totalReportingEmployees = directReportsMap[String(u._id)] || 0;
            }
            return doc;
        });

        res.json(enhancedUsers);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Recent notifications for the authenticated user (Admin, Manager, Employee)
exports.getRecentNotifications = async (req, res) => {
    try {
        const userId = req.userId;
        const role = req.userRole;
        const notifications = [];

        if (role === 'Admin') {
            const AdminNotification = require('../models/AdminNotification');
            const LeaveRequest = require('../models/LeaveRequest');
            const ChatSession = require('../models/ChatSession');
            const [adminNotifs, pendingLeaves, pendingManagerChats] = await Promise.all([
                AdminNotification.find().populate('sender', 'name designation').sort({ createdAt: -1 }).limit(10).lean(),
                LeaveRequest.find({ status: 'pending' }).populate('user', 'name designation').sort({ createdAt: -1 }).limit(5).lean(),
                ChatSession.find({ type: 'MANAGER_ADMIN', status: 'pending' }).populate('initiator', 'name designation department').sort({ createdAt: -1 }).limit(5).lean(),
            ]);

            adminNotifs.forEach((n) => {
                notifications.push({
                    _id: n._id,
                    title: n.title,
                    message: n.message,
                    type: n.type || 'alert',
                    priority: n.priority || 'Medium',
                    isRead: n.isRead,
                    createdAt: n.createdAt,
                    sender: n.sender?.name || 'Manager',
                    link: '/dashboard?view=admin'
                });
            });

            pendingLeaves.forEach((l) => {
                notifications.push({
                    _id: l._id,
                    title: 'Leave Request Pending Review',
                    message: `${l.user?.name || 'Employee'} requested ${l.totalDays} day(s) of ${l.leaveType} leave.`,
                    type: 'leave',
                    priority: 'High',
                    isRead: false,
                    createdAt: l.createdAt,
                    link: '/dashboard?view=admin-leaves'
                });
            });

            pendingManagerChats.forEach((s) => {
                notifications.push({
                    _id: s._id,
                    title: 'Manager Chat Request Pending',
                    message: `${s.initiator?.name || 'Manager'} (${s.initiator?.department || 'Operations'}) requested chat permission: "${s.subject}".`,
                    type: 'chat',
                    priority: 'High',
                    isRead: false,
                    createdAt: s.createdAt,
                    link: '/dashboard?view=chat'
                });
            });
        } else if (role === 'Manager') {
            const Task = require('../models/Task');
            const LeaveRequest = require('../models/LeaveRequest');
            const User = require('../models/User');
            const ChatSession = require('../models/ChatSession');

            // Find direct reports
            const directReports = await User.find({ manager: userId }).select('_id');
            const reportIds = directReports.map(u => u._id);

            const [reviewTasks, teamLeaves, pendingEmployeeChats, adminChatDecisions] = await Promise.all([
                Task.find({ user: { $in: reportIds }, status: 'in-review' }).populate('user', 'name').sort({ updatedAt: -1 }).limit(6).lean(),
                LeaveRequest.find({ user: { $in: reportIds }, status: 'pending' }).populate('user', 'name').sort({ createdAt: -1 }).limit(6).lean(),
                ChatSession.find({ recipient: userId, status: 'pending' }).populate('initiator', 'name designation department').sort({ createdAt: -1 }).limit(6).lean(),
                ChatSession.find({ initiator: userId, type: 'MANAGER_ADMIN', status: { $in: ['approved', 'rejected'] } }).populate('recipient', 'name').sort({ updatedAt: -1 }).limit(5).lean(),
            ]);

            reviewTasks.forEach((t) => {
                notifications.push({
                    _id: t._id,
                    title: 'Task Submitted for Review',
                    message: `${t.user?.name || 'Team member'} submitted "${t.title}" for review.`,
                    type: 'task',
                    priority: 'Medium',
                    isRead: false,
                    createdAt: t.updatedAt || t.createdAt,
                    link: '/dashboard?view=tasks'
                });
            });

            teamLeaves.forEach((l) => {
                notifications.push({
                    _id: l._id,
                    title: 'Team Leave Request Pending',
                    message: `${l.user?.name || 'Member'} applied for ${l.leaveType} leave (${l.totalDays} days).`,
                    type: 'leave',
                    priority: 'High',
                    isRead: false,
                    createdAt: l.createdAt,
                    link: '/dashboard?view=manager&tab=leave'
                });
            });

            pendingEmployeeChats.forEach((s) => {
                notifications.push({
                    _id: s._id,
                    title: 'Chat Permission Request',
                    message: `${s.initiator?.name || 'Team member'} requested permission to chat: "${s.subject}".`,
                    type: 'chat',
                    priority: 'High',
                    isRead: false,
                    createdAt: s.createdAt,
                    link: '/dashboard?view=manager&tab=chat'
                });
            });

            adminChatDecisions.forEach((s) => {
                const isApproved = s.status === 'approved';
                notifications.push({
                    _id: s._id,
                    title: isApproved ? 'Chat Request Approved by Admin' : 'Chat Request Declined by Admin',
                    message: isApproved
                        ? `Executive Administration approved your chat request for "${s.subject}". Real-time messaging is unlocked.`
                        : `Executive Administration declined your chat request for "${s.subject}".`,
                    type: 'chat',
                    priority: isApproved ? 'High' : 'Medium',
                    isRead: false,
                    createdAt: s.approvedAt || s.updatedAt || s.createdAt,
                    link: '/dashboard?view=manager&tab=chat'
                });
            });
        } else {
            // Employee
            const Task = require('../models/Task');
            const LeaveRequest = require('../models/LeaveRequest');
            const ChatSession = require('../models/ChatSession');

            const [modTasks, recentLeaves, chatDecisions] = await Promise.all([
                Task.find({ user: userId, needsModification: true }).sort({ updatedAt: -1 }).limit(5).lean(),
                LeaveRequest.find({ user: userId }).sort({ updatedAt: -1 }).limit(5).lean(),
                ChatSession.find({
                    initiator: userId,
                    type: 'EMPLOYEE_MANAGER',
                    status: { $in: ['approved', 'rejected'] },
                }).populate('recipient', 'name designation').sort({ updatedAt: -1 }).limit(5).lean(),
            ]);

            modTasks.forEach((t) => {
                notifications.push({
                    _id: t._id,
                    title: 'Revision Requested by Manager',
                    message: `Manager requested modifications on task "${t.title}".`,
                    type: 'revision',
                    priority: 'High',
                    isRead: false,
                    createdAt: t.updatedAt || t.createdAt,
                    link: '/dashboard?view=employee&tab=tasks'
                });
            });

            recentLeaves.forEach((l) => {
                if (l.status === 'approved' || l.status === 'rejected') {
                    notifications.push({
                        _id: l._id,
                        title: `Leave Request ${l.status === 'approved' ? 'Approved' : 'Rejected'}`,
                        message: `Your ${l.leaveType} leave request was ${l.status}.`,
                        type: 'leave',
                        priority: l.status === 'approved' ? 'Low' : 'High',
                        isRead: false,
                        createdAt: l.updatedAt || l.createdAt,
                        link: '/dashboard?view=employee&tab=leave'
                    });
                }
            });

            chatDecisions.forEach((s) => {
                const isApproved = s.status === 'approved';
                notifications.push({
                    _id: s._id,
                    title: isApproved ? 'Chat Request Approved' : 'Chat Request Declined',
                    message: isApproved
                        ? `Your reporting manager (${s.recipient?.name || 'Manager'}) approved your chat request for "${s.subject}". You can now chat directly.`
                        : `Your reporting manager declined your chat request for "${s.subject}".`,
                    type: 'chat',
                    priority: isApproved ? 'High' : 'Medium',
                    isRead: false,
                    createdAt: s.approvedAt || s.updatedAt || s.createdAt,
                    link: '/dashboard?view=employee&tab=chat'
                });
            });
        }

        // Sort descending by date
        notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(notifications);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
