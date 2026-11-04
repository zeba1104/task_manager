const User = require('../models/User');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Task = require('../models/Task');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const FocusSession = require('../models/FocusSession');
const logActivity = require('../activityLogger');
const { sendEmployeeCredentialsEmail } = require('../config/email');

const profilePicturesDirectory = path.join(__dirname, '..', 'uploads', 'profile-pictures');

const createEmployeeAccount = async (data, actorId) => {
    const email = String(data.email || '').trim().toLowerCase();
    const employeeId = String(data.employeeId || '').trim().toUpperCase();
    const firstName = String(data.firstName || '').trim();
    const lastName = String(data.lastName || '').trim();
    const name = [firstName, lastName].filter(Boolean).join(' ') || String(data.name || '').trim();
    if (!name || !email) throw Object.assign(new Error('First name and email are required'), { status: 400 });

    const duplicate = await User.findOne({
        $or: [
            { email },
            ...(employeeId ? [{ employeeId }] : []),
        ],
    }).select('email employeeId');
    if (duplicate) {
        const field = duplicate.email === email ? 'Email' : 'Employee ID';
        throw Object.assign(new Error(`${field} already exists`), { status: 409 });
    }

    const temporaryPassword = crypto.randomBytes(12).toString('base64url');
    const hashedPassword = await bcrypt.hash(temporaryPassword, await bcrypt.genSalt(10));
    const user = await User.create({
        name,
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role: data.role || 'Employee',
        department: data.department || 'General',
        departmentHistory: [{
            fromDepartment: '',
            toDepartment: data.department || 'General',
            changedBy: actorId,
            changedAt: new Date(),
        }],
        manager: data.manager || null,
        isActive: data.isActive !== false,
        isSuspended: data.isSuspended === true,
        employeeId: employeeId || undefined,
        phone: data.phone || '',
        designation: data.designation || '',
        responsibilities: data.responsibilities || '',
        team: data.team || '',
        joiningDate: data.joiningDate || null,
    });

    let credentialsSent = true;
    try {
        await sendEmployeeCredentialsEmail(user, temporaryPassword);
    } catch (emailError) {
        credentialsSent = false;
        console.error('Employee credentials email could not be sent:', emailError.message);
    }
    user.credentialsSent = credentialsSent;
    await user.save();
    logActivity(actorId, 'added employee', 'employee', user.name);
    return { user, credentialsSent };
};

// Create user (Admin only)
exports.createUser = async (req, res) => {
    try {
        if (req.userRole !== 'Admin') return res.status(403).json({ message: 'Access denied' });
        
        const { user, credentialsSent } = await createEmployeeAccount(req.body, req.userId);
        return res.status(201).json({
            user: await User.findById(user._id).select('-password'),
            credentialsSent,
            message: credentialsSent
                ? 'Employee created and login credentials emailed.'
                : 'Employee created, but login credentials could not be emailed. Check SMTP configuration.',
        });
    } catch (err) {
        res.status(err.status || (err.code === 11000 ? 409 : 500)).json({ message: err.code === 11000 ? 'Email or employee ID already exists' : err.message });
    }
};

// Update user (Admin only)
exports.updateUser = async (req, res) => {
    try {
        if (req.userRole !== 'Admin') return res.status(403).json({ message: 'Access denied' });
        
        const allowedFields = ['email', 'password', 'role', 'department', 'manager', 'isActive', 'isSuspended', 'firstName', 'lastName', 'phone', 'employeeId', 'designation', 'responsibilities', 'team', 'joiningDate'];
        const updates = {};
        allowedFields.forEach((field) => {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) updates[field] = req.body[field];
        });
        if (updates.email) updates.email = String(updates.email).trim().toLowerCase();
        if (updates.employeeId !== undefined) {
            updates.employeeId = String(updates.employeeId).trim().toUpperCase();
            if (!updates.employeeId) delete updates.employeeId;
        }
        if (updates.employeeId || updates.email) {
            const duplicate = await User.findOne({
                _id: { $ne: req.params.id },
                $or: [
                    ...(updates.email ? [{ email: updates.email }] : []),
                    ...(updates.employeeId ? [{ employeeId: updates.employeeId }] : []),
                ],
            }).select('email employeeId');
            if (duplicate) return res.status(409).json({ message: duplicate.email === updates.email ? 'Email already exists' : 'Employee ID already exists' });
        }
        if (updates.firstName !== undefined || updates.lastName !== undefined) {
            const existing = await User.findById(req.params.id).select('firstName lastName name');
            if (!existing) return res.status(404).json({ message: 'Employee not found' });
            updates.name = [updates.firstName ?? existing.firstName, updates.lastName ?? existing.lastName].filter(Boolean).join(' ').trim() || existing.name;
        }
        if (updates.department !== undefined) {
            updates.department = String(updates.department || '').trim() || 'General';
            const existing = await User.findById(req.params.id).select('department departmentHistory');
            if (!existing) return res.status(404).json({ message: 'Employee not found' });
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
        if (updates.password) {
            const salt = await bcrypt.genSalt(10);
            updates.password = await bcrypt.hash(updates.password, salt);
        }
        
        const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select('-password');
        if (!user) return res.status(404).json({ message: 'Employee not found' });
        const activityAction = updates.isSuspended
            ? 'suspended employee'
            : updates.isActive === false
                ? 'deactivated employee'
                : updates.isActive === true
                    ? 'activated employee'
                    : 'updated employee profile';
        logActivity(req.userId, activityAction, 'employee', user.name);
        res.json(user);
    } catch (err) {
        res.status(err.status || (err.code === 11000 ? 409 : 500)).json({ message: err.code === 11000 ? 'Email or employee ID already exists' : err.message });
    }
};

exports.importUsers = async (req, res) => {
    if (req.userRole !== 'Admin') return res.status(403).json({ message: 'Access denied' });
    const rows = req.body.users;
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 200) {
        return res.status(400).json({ message: 'Upload a file with 1 to 200 employee rows' });
    }
    const created = [];
    const failed = [];
    for (let index = 0; index < rows.length; index += 1) {
        try {
            const result = await createEmployeeAccount(rows[index], req.userId);
            created.push({ row: index + 2, name: result.user.name, email: result.user.email, credentialsSent: result.credentialsSent });
        } catch (error) {
            failed.push({ row: index + 2, email: String(rows[index].email || ''), message: error.message });
        }
    }
    return res.status(200).json({ created, failed });
};

exports.getUserProfile = async (req, res) => {
    if (req.userRole !== 'Admin') return res.status(403).json({ message: 'Access denied' });
    try {
        const [user, tasks, attendance, leaveHistory, focusSessions] = await Promise.all([
            User.findById(req.params.id).select('-password').populate('manager', 'name email'),
            Task.find({ user: req.params.id }).select('title project status priority deadline createdAt updatedAt'),
            Attendance.find({ user: req.params.id }).sort({ date: -1 }).limit(90),
            LeaveRequest.find({ user: req.params.id }).sort({ createdAt: -1 }).limit(30),
            FocusSession.find({ user: req.params.id }).select('durationSeconds startTime').limit(100),
        ]);
        if (!user) return res.status(404).json({ message: 'Employee not found' });
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
        return res.status(500).json({ message: 'Could not load employee profile' });
    }
};

exports.uploadProfilePicture = async (req, res) => {
    if (req.userRole !== 'Admin') {
        if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(403).json({ message: 'Access denied' });
    }
    if (!req.file) return res.status(400).json({ message: 'Choose an image to upload' });
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            await fs.promises.unlink(req.file.path).catch(() => {});
            return res.status(404).json({ message: 'Employee not found' });
        }
        if (user.profilePicture) {
            await fs.promises.unlink(path.join(profilePicturesDirectory, path.basename(user.profilePicture))).catch(() => {});
        }
        user.profilePicture = req.file.filename;
        await user.save();
        return res.json({ profilePicture: user.profilePicture });
    } catch (error) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(500).json({ message: 'Could not save profile picture' });
    }
};

exports.resendCredentials = async (req, res) => {
    if (req.userRole !== 'Admin') return res.status(403).json({ message: 'Access denied' });
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return res.status(503).json({ message: 'SMTP is not configured; credentials cannot be emailed' });
    }
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'Employee not found' });
        const temporaryPassword = crypto.randomBytes(12).toString('base64url');
        user.password = await bcrypt.hash(temporaryPassword, await bcrypt.genSalt(10));
        user.credentialsSent = false;
        await user.save();
        await sendEmployeeCredentialsEmail(user, temporaryPassword);
        user.credentialsSent = true;
        await user.save();
        return res.json({ message: 'New login credentials emailed successfully' });
    } catch (error) {
        console.error('Credential resend failed:', error.message);
        return res.status(503).json({ message: 'Could not email new credentials. Check SMTP configuration.' });
    }
};

exports.getProfilePicture = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('profilePicture');
        if (!user?.profilePicture) return res.status(404).json({ message: 'Profile picture not found' });
        if (req.userRole !== 'Admin' && String(req.userId) !== String(req.params.id)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        return res.sendFile(path.join(profilePicturesDirectory, path.basename(user.profilePicture)));
    } catch (error) {
        return res.status(500).json({ message: 'Could not load profile picture' });
    }
};

// Delete user (Admin only)
exports.deleteUser = async (req, res) => {
    try {
        if (req.userRole !== 'Admin') return res.status(403).json({ message: 'Access denied' });
        const user = await User.findByIdAndDelete(req.params.id);
        if (user?.profilePicture) {
            await fs.promises.unlink(path.join(profilePicturesDirectory, path.basename(user.profilePicture))).catch(() => {});
        }
        if (user) logActivity(req.userId, 'deleted employee', 'employee', user.name);
        res.json({ message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get all users (already partially exists in authController but we need full list for admin)
exports.getAllUsers = async (req, res) => {
    try {
        if (req.userRole !== 'Admin') return res.status(403).json({ message: 'Access denied' });
        const users = await User.find().select('-password').populate('manager', 'name email');
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
