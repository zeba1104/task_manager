const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const authMiddleware = require('../middleware/authMiddleware');
const {
    getOverview,
    getProfile,
    updateProfile,
    changePassword,
    createProfileChangeRequest,
    // Team Management
    getTeamMembers,
    getEmployeeProfile,
    addEmployeeFeedback,
    requestEmployeeTransfer,
    getTransferRequests,
    getTeamPerformanceReports,
    // Project Management
    getManagerProjects,
    getManagerProjectDetails,
    createManagerProject,
    updateManagerProject,
    addProjectMilestone,
    updateProjectMilestone,
    deleteProjectMilestone,
    uploadProjectDocument,
    downloadProjectDocument,
    deleteProjectDocument,
    addProjectComment,
    notifyAdminProjectUpdate,
    generateProjectProgressReport,
    getTasksForReview,
    reviewTask,
} = require('../controllers/managerController');

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
    limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
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

/* --- Profile & Overview --- */
router.get('/overview', getOverview);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/password', changePassword);
router.post('/profile-change-requests', createProfileChangeRequest);

/* --- 1.3 Team Management --- */
router.get('/team', getTeamMembers);
router.get('/team/employee/:id', getEmployeeProfile);
router.post('/team/employee/:id/feedback', addEmployeeFeedback);
router.post('/team/transfer-request', requestEmployeeTransfer);
router.get('/team/transfer-requests', getTransferRequests);
router.get('/team/performance-reports', getTeamPerformanceReports);

/* --- 1.4 Project Management --- */
router.get('/projects', getManagerProjects);
router.get('/projects/:id', getManagerProjectDetails);
router.post('/projects', createManagerProject);
router.put('/projects/:id', updateManagerProject);
router.post('/projects/:id/milestones', addProjectMilestone);
router.put('/projects/:id/milestones/:milestoneId', updateProjectMilestone);
router.delete('/projects/:id/milestones/:milestoneId', deleteProjectMilestone);
router.post('/projects/:id/documents', handleDocUpload, uploadProjectDocument);
router.get('/projects/:id/documents/:docId', downloadProjectDocument);
router.delete('/projects/:id/documents/:docId', deleteProjectDocument);
router.post('/projects/:id/comments', addProjectComment);
router.post('/projects/:id/notify-admin', notifyAdminProjectUpdate);
router.get('/projects/:id/report', generateProjectProgressReport);

/* --- Task Review Workflow --- */
router.get('/tasks/reviews', getTasksForReview);
router.post('/tasks/:id/review', reviewTask);

module.exports = router;
