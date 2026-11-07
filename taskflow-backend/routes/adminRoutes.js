const express = require('express');
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
} = require('../controllers/adminController');

const router = express.Router();
router.use(authMiddleware);

router.get('/overview', getOverview);
router.get('/departments', getDepartments);
router.get('/projects', getProjects);
router.post('/departments', createDepartment);
router.put('/departments/:id', updateDepartment);
router.patch('/profile-change-requests/:id', reviewProfileChangeRequest);
router.post('/projects', createProject);
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
