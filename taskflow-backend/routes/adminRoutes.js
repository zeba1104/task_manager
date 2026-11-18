const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const authMiddleware = require('../middleware/authMiddleware');
const {
    getOverview,
    getDepartments,
    getProjects,
    createDepartment,
    updateDepartment,
    reviewProfileChangeRequest,
    createProject,
    createAnnouncement,
    getAnnouncements,
    deleteAnnouncement,
    createLeaveRequest,
    getMyLeaveRequests,
    reviewLeaveRequest,
    getTransferRequests,
    reviewTransferRequest,
    getAdminNotifications,
    markAdminNotificationRead,
    getProjectDocuments,
    uploadProjectDocument,
    downloadProjectDocument,
    deleteProjectDocument,
} = require('../controllers/adminController');

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
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
});

const handleDocUpload = (req, res, next) => {
    docUpload.single('document')(req, res, (error) => {
        if (!error) return next();
        const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({
            message: status === 413 ? 'Document exceeds 50MB limit' : error.message,
        });
    });
};

const router = express.Router();
router.use(authMiddleware);

router.get('/overview', getOverview);
router.get('/departments', getDepartments);
router.get('/projects', getProjects);
router.post('/departments', createDepartment);
router.put('/departments/:id', updateDepartment);
router.patch('/profile-change-requests/:id', reviewProfileChangeRequest);
router.post('/projects', createProject);

// Project Documents (Admin Authority)
router.get('/projects/:id/documents', getProjectDocuments);
router.post('/projects/:id/documents', handleDocUpload, uploadProjectDocument);
router.get('/projects/:id/documents/:docId', downloadProjectDocument);
router.get('/projects/:id/documents/:docId/download', downloadProjectDocument);
router.delete('/projects/:id/documents/:docId', deleteProjectDocument);

router.post('/announcements', createAnnouncement);
router.get('/announcements', getAnnouncements);
router.delete('/announcements/:id', deleteAnnouncement);
router.post('/leave', createLeaveRequest);
router.get('/leave/mine', getMyLeaveRequests);
router.patch('/leave/:id', reviewLeaveRequest);

// Transfer requests & Notifications
router.get('/transfer-requests', getTransferRequests);
router.patch('/transfer-requests/:id', reviewTransferRequest);
router.get('/notifications', getAdminNotifications);
router.patch('/notifications/:id/read', markAdminNotificationRead);

module.exports = router;
