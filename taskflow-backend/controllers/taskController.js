const Task = require('../models/Task');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');
const logActivity = require('../activityLogger');
const getManagerScope = require('../managerScope');
const Project = require('../models/Project');

const uploadsDirectory = path.join(__dirname, '..', 'uploads');

const handleTaskError = (res, error) => {
    console.error('Task operation failed:', error.message);
    if (['MongooseServerSelectionError', 'MongoNetworkError', 'MongoNotConnectedError'].includes(error.name)) {
        return res.status(503).json({ message: 'Database connection unavailable. Check MongoDB Atlas Network Access and try again.' });
    }
    if (error.name === 'ValidationError' || error.name === 'CastError') {
        return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Task operation failed. Please try again.' });
};

const getTaskFilter = async (req, taskId) => {
    const filter = taskId ? { _id: taskId } : {};
    if (req.userRole === 'Employee') {
        filter.user = req.userId;
    } else if (req.userRole === 'Manager') {
        const scope = await getManagerScope(req.userId);
        filter.user = { $in: scope?.memberIds || [req.userId] };
    }
    return filter;
};

const createTask = async (req, res) => {
    try {
        const { title, description, status, priority, category, project, assignedTo, deadline, estimatedMinutes } = req.body;
        
        let taskUser = req.userId;
        if (assignedTo && (req.userRole === 'Manager' || req.userRole === 'Admin')) {
            taskUser = assignedTo;
        }
        if (req.userRole === 'Manager') {
            const scope = await getManagerScope(req.userId);
            if (!scope?.memberIds.some((memberId) => String(memberId) === String(taskUser))) {
                return res.status(403).json({ message: 'You can only assign tasks within your assigned team or department' });
            }
            if (project) {
                const projectFilter = scope.isDepartmentHead && scope.department
                    ? { $or: [{ manager: req.userId }, { department: scope.department._id }] }
                    : { manager: req.userId };
                const escapedProjectName = String(project).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const allowedProject = await Project.findOne({ ...projectFilter, name: { $regex: `^${escapedProjectName}$`, $options: 'i' } }).select('_id');
                if (!allowedProject) return res.status(403).json({ message: 'You can only assign tasks to projects in your scope' });
            }
        }

        const task = await Task.create({ title, description, status, priority, category, project, user: taskUser, deadline, estimatedMinutes });
        logActivity(req.userId, assignedTo ? 'assigned task' : 'created task', 'task', task.title);
        res.status(201).json(task);
    }
    catch (error) {
        return handleTaskError(res, error);
    }
};

const getTask = async (req, res) => {
    try {
        const { status, category } = req.query;
        const filter = await getTaskFilter(req);

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
        const task = await Task.findOne(await getTaskFilter(req, req.params.id))
            .populate('comments.user', 'name');
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
        const filter = await getTaskFilter(req, req.params.id);
        const allowedFields = ['title', 'description', 'status', 'priority', 'category', 'project', 'deadline', 'estimatedMinutes', 'subtasks'];
        const updates = {};
        allowedFields.forEach((field) => {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                updates[field] = req.body[field];
            }
        });
        if (req.body.assignedTo && (req.userRole === 'Manager' || req.userRole === 'Admin')) {
            updates.user = req.body.assignedTo;
        }
        if (req.userRole === 'Manager') {
            const scope = await getManagerScope(req.userId);
            if (updates.user && !scope?.memberIds.some((memberId) => String(memberId) === String(updates.user))) {
                return res.status(403).json({ message: 'You can only assign tasks within your assigned team or department' });
            }
            if (updates.project) {
                const projectFilter = scope?.isDepartmentHead && scope.department
                    ? { $or: [{ manager: req.userId }, { department: scope.department._id }] }
                    : { manager: req.userId };
                const escapedProjectName = String(updates.project).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const allowedProject = await Project.findOne({ ...projectFilter, name: { $regex: `^${escapedProjectName}$`, $options: 'i' } }).select('_id');
                if (!allowedProject) return res.status(403).json({ message: 'You can only assign tasks to projects in your scope' });
            }
        }

        const previousTask = await Task.findOne(filter).select('title status user').lean();
        if (!previousTask) return res.status(404).json({ message: 'Task not found' });
        const task = await Task.findOneAndUpdate(filter,
            updates,
            { new: true, runValidators: true });
        if (!task) {
            return res.status(404).json({ message: 'Task not founds' });
        }
        if (updates.status && updates.status !== previousTask.status) {
            logActivity(req.userId, 'updated task status', 'task', task.title, `Status changed to ${task.status}`);
        }
        if (updates.user && String(updates.user) !== String(previousTask.user)) {
            logActivity(req.userId, 'assigned task', 'task', task.title);
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
        
        const task = await Task.findOneAndDelete(await getTaskFilter(req, req.params.id));
        if (!task) {
            return res.status(404).json({ message: 'Task not found ' });
        }
        await Promise.all(task.attachments.map((attachment) => (
            fs.promises.unlink(path.join(uploadsDirectory, attachment.fileName)).catch(() => {})
        )));
        res.status(200).json({ message: 'Task deleted Successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
}

const addTaskComment = async (req, res) => {
    try {
        const text = String(req.body.text || '').trim();
        if (!text) return res.status(400).json({ message: 'Comment cannot be empty' });

        const task = await Task.findOne(await getTaskFilter(req, req.params.id));
        if (!task) return res.status(404).json({ message: 'Task not found' });
        task.comments.push({ text, user: req.userId });
        await task.save();
        await task.populate('comments.user', 'name');
        return res.status(201).json(task.comments[task.comments.length - 1]);
    } catch (error) {
        return res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const addTaskAttachment = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Choose a file to upload' });
        const task = await Task.findOne(await getTaskFilter(req, req.params.id));
        if (!task) {
            await fs.promises.unlink(req.file.path).catch(() => {});
            return res.status(404).json({ message: 'Task not found' });
        }

        task.attachments.push({
            originalName: path.basename(req.file.originalname),
            fileName: req.file.filename,
            contentType: req.file.mimetype,
            size: req.file.size,
            user: req.userId,
        });
        await task.save();
        return res.status(201).json(task.attachments[task.attachments.length - 1]);
    } catch (error) {
        if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const downloadTaskAttachment = async (req, res) => {
    try {
        const task = await Task.findOne(await getTaskFilter(req, req.params.id));
        if (!task) return res.status(404).json({ message: 'Task not found' });
        const attachment = task.attachments.id(req.params.attachmentId);
        if (!attachment) return res.status(404).json({ message: 'Attachment not found' });
        return res.download(path.join(uploadsDirectory, attachment.fileName), attachment.originalName);
    } catch (error) {
        return res.status(500).json({ message: 'Could not download attachment' });
    }
};

const deleteTaskAttachment = async (req, res) => {
    try {
        const task = await Task.findOne(await getTaskFilter(req, req.params.id));
        if (!task) return res.status(404).json({ message: 'Task not found' });
        const attachment = task.attachments.id(req.params.attachmentId);
        if (!attachment) return res.status(404).json({ message: 'Attachment not found' });
        if (req.userRole !== 'Admin' && String(attachment.user) !== String(req.userId)) {
            return res.status(403).json({ message: 'Only the uploader or an admin can delete this attachment' });
        }
        const filePath = path.join(uploadsDirectory, attachment.fileName);
        attachment.deleteOne();
        await task.save();
        await fs.promises.unlink(filePath).catch(() => {});
        return res.status(200).json({ message: 'Attachment deleted' });
    } catch (error) {
        return res.status(500).json({ message: 'Could not delete attachment' });
    }
};

module.exports = {
    createTask,
    getTask,
    getTaskbyId,
    updateTask,
    deleteTask,
    addTaskComment,
    addTaskAttachment,
    downloadTaskAttachment,
    deleteTaskAttachment,
    uploadsDirectory,
};