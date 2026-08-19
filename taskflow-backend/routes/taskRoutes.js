const express = require('express');
const router = express.Router();
const { createTask, getTask, getTaskbyId, updateTask, deleteTask } = require('../controllers/taskController');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

router.post('/', createTask);
router.get('/', getTask);
router.get('/:id', getTaskbyId);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);

module.exports= router;