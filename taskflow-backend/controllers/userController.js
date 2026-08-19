const User = require('../models/User');
const bcrypt = require('bcrypt');

// Create user (Admin only)
exports.createUser = async (req, res) => {
    try {
        if (req.userRole !== 'Admin') return res.status(403).json({ message: 'Access denied' });
        
        const { name, email, password, role, department, manager, isActive } = req.body;
        
        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ message: 'User already exists' });
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        const user = await User.create({
            name, email, password: hashedPassword, role, department, manager, isActive
        });
        
        res.status(201).json(user);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Update user (Admin only)
exports.updateUser = async (req, res) => {
    try {
        if (req.userRole !== 'Admin') return res.status(403).json({ message: 'Access denied' });
        
        const updates = { ...req.body };
        if (updates.password) {
            const salt = await bcrypt.genSalt(10);
            updates.password = await bcrypt.hash(updates.password, salt);
        }
        
        const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Delete user (Admin only)
exports.deleteUser = async (req, res) => {
    try {
        if (req.userRole !== 'Admin') return res.status(403).json({ message: 'Access denied' });
        await User.findByIdAndDelete(req.params.id);
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
