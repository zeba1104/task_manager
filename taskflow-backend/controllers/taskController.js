const Task = require('../models/Task');

const createTask = async (req, res) => {
    try {
        const { title, description, status, priority, category, assignedTo, deadline } = req.body;
        
        let taskUser = req.userId;
        if (assignedTo && (req.userRole === 'Manager' || req.userRole === 'Admin')) {
            taskUser = assignedTo;
        }

        const task = await Task.create({ title, description, status, priority, category, user: taskUser, deadline });
        res.status(201).json(task);
    }
    catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const getTask = async (req, res) => {
    try {
        const { status, category } = req.query;

        const filter = {};
        if (req.userRole === 'Employee') {
            filter.user = req.userId;
        } else if (req.userRole === 'Manager') {
            const User = require('../models/User');
            const team = await User.find({ manager: req.userId }).select('_id');
            const teamIds = team.map(u => u._id);
            teamIds.push(req.userId);
            filter.user = { $in: teamIds };
        }

        if (status) filter.status = status;
        if (category) filter.category = category;

        const tasks = await Task.find(filter).populate('user', 'name').sort({ createdAt: -1 });
        res.status(200).json(tasks);
    }
    catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message })
    }
}

const getTaskbyId = async (req, res) => {
    try {
        const task = await Task.findOne({ _id: req.params.id, user: req.userId });
        if (!task) {
            return res.status(404).json({ message: 'Task not Found' })
        }
        res.status(200).json(task);
    }
    catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message })
    }
}

const updateTask = async (req, res) => {
    try {
        const filter = { _id: req.params.id };
        if (req.userRole === 'Employee') filter.user = req.userId;

        const task = await Task.findOneAndUpdate(filter,
            req.body,
            { new: true, runValidators: true });
        if (!task) {
            return res.status(404).json({ message: 'Task not founds' });
        }
        res.status(200).json(task);
    }
    catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
}

const deleteTask = async (req, res) => {
    try {
        if (req.userRole === 'Manager') {
            return res.status(403).json({ message: 'Managers cannot delete tasks, only Admin or the Employee owner can.' });
        }
        
        const filter = { _id: req.params.id };
        if (req.userRole === 'Employee') filter.user = req.userId;

        const task = await Task.findOneAndDelete(filter);
        if (!task) {
            return res.status(404).json({ message: 'Task not found ' });
        }
        res.status(200).json({ message: 'Task deleted Successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
}
module.exports = { createTask, getTask, getTaskbyId, updateTask, deleteTask };