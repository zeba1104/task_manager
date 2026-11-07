const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const sendAccountCreatedEmail = require('../config/email');
const logActivity = require('../activityLogger');
const getManagerScope = require('../managerScope');

const registerUser = async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        if (userCount > 0) {
            return res.status(403).json({
                message: 'Public account registration is disabled. Employee and Manager accounts are created exclusively by the Organization Administrator in the Admin Panel.',
                registrationDisabled: true,
            });
        }

        const { name, email, password, role } = req.body;
        // check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        // create user (initial admin setup)
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            role: role || 'Admin',
        });
        logActivity(user._id, 'joined the organization as initial administrator', 'admin', user.name);

        let emailSent = true;
        try {
            await sendAccountCreatedEmail(user);
        } catch (emailError) {
            emailSent = false;
            console.error('Registration email could not be sent:', emailError.message);
        }

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: emailSent
                ? 'Initial Administrator account registered successfully.'
                : 'Initial Administrator account registered successfully, but email could not be sent.',
            emailSent,
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role },
        });
    }
    catch (error) {
        if (['MongooseServerSelectionError', 'MongoNetworkError', 'MongoNotConnectedError'].includes(error.name)) {
            console.error('Registration database connection failed:', error.message);
            return res.status(503).json({ message: 'Database connection unavailable. Check MongoDB Atlas Network Access and try again.' });
        }
        if (error.code === 11000) {
            return res.status(409).json({ message: 'An account with this email already exists' });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        console.error('Registration failed:', error.message);
        return res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
};

// Login User
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        // check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        if (user.isActive === false || user.isSuspended) {
            return res.status(403).json({ message: 'This account is deactivated or suspended' });
        }
        // check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        // generate JWT
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        res.status(200).json({ message: 'Login Successfull', token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    }
    catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const getUsers = async (req, res) => {
    try {
        if (req.userRole === 'Employee') {
            return res.status(403).json({ message: 'Not authorized to view users' });
        }
        if (req.userRole === 'Manager') {
            const scope = await getManagerScope(req.userId);
            return res.status(200).json(scope?.employees || []);
        }
        const users = await User.find({}, 'name email role department manager isActive isSuspended team designation employeeId');
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

module.exports = { registerUser, loginUser, getUsers };
