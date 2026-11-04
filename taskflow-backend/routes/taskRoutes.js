const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const router = express.Router();
const {
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
} = require('../controllers/taskController');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

const upload = multer({
	storage: multer.diskStorage({
		destination: (req, file, callback) => {
			fs.mkdir(uploadsDirectory, { recursive: true }, (error) => callback(error, uploadsDirectory));
		},
		filename: (req, file, callback) => {
			const extension = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 12);
			callback(null, `${crypto.randomUUID()}${extension}`);
		},
	}),
	limits: { fileSize: 10 * 1024 * 1024 },
});

const receiveAttachment = (req, res, next) => {
	upload.single('file')(req, res, (error) => {
		if (!error) return next();
		const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
		return res.status(status).json({ message: status === 413 ? 'Files must be 10 MB or smaller' : 'Could not upload file' });
	});
};

router.post('/', createTask);
router.get('/', getTask);
router.post('/:id/comments', addTaskComment);
router.post('/:id/attachments', receiveAttachment, addTaskAttachment);
router.get('/:id/attachments/:attachmentId', downloadTaskAttachment);
router.delete('/:id/attachments/:attachmentId', deleteTaskAttachment);
router.get('/:id', getTaskbyId);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);

module.exports= router;