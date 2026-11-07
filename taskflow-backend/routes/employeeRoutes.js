const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const authMiddleware = require('../middleware/authMiddleware');
const {
    getDashboard,
    getProfile,
    updatePermittedProfile,
    changePassword,
    requestProfileChange,
    getMyProjects,
    getProjectDetails,
    uploadProjectDocument,
    addProjectComment,
    getMyTasks,
    getTaskDetails,
    updateTaskStatus,
    submitTaskForReview,
    resubmitTask,
    addTaskProgressUpdate,
    getUpcomingMeetings,
} = require('../controllers/employeeController');

const router = express.Router();
router.use(authMiddleware);

// Multer storage for project documents
const projectDocsDirectory = path.join(__dirname, '..', 'uploads', 'project-documents');
fs.mkdirSync(projectDocsDirectory, { recursive: true });

const docStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, projectDocsDirectory),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${crypto.randomUUID()}${ext}`);
    },
});

const docUpload = multer({
    storage: docStorage,
    limits: { fileSize: 25 * 1024 * 1024 },
});

const handleDocUpload = (req, res, next) => {
    docUpload.single('document')(req, res, (error) => {
        if (!error) return next();
        const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({
            message: status === 413 ? 'Document exceeds 25MB limit' : error.message,
        });
    });
};

/* --- 1.1 Employee Dashboard --- */
router.get('/dashboard', getDashboard);
router.get('/meetings', getUpcomingMeetings);

/* --- 1.2 My Profile & Department Information --- */
router.get('/profile', getProfile);
router.put('/profile', updatePermittedProfile);
router.put('/password', changePassword);
router.post('/profile-change-requests', requestProfileChange);

/* --- 1.3 My Projects --- */
router.get('/projects', getMyProjects);
router.get('/projects/:id', getProjectDetails);
router.post('/projects/:id/documents', handleDocUpload, uploadProjectDocument);
router.post('/projects/:id/comments', addProjectComment);

/* --- 1.4 My Tasks --- */
router.get('/tasks', getMyTasks);
router.get('/tasks/:id', getTaskDetails);
router.put('/tasks/:id/status', updateTaskStatus);
router.post('/tasks/:id/submit-work', submitTaskForReview);
router.post('/tasks/:id/resubmit', resubmitTask);
router.post('/tasks/:id/progress-update', addTaskProgressUpdate);

module.exports = router;
