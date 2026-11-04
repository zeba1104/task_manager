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
    createLeaveRequest,
    getMyLeaveRequests,
    reviewLeaveRequest,
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
router.post('/leave', createLeaveRequest);
router.get('/leave/mine', getMyLeaveRequests);
router.patch('/leave/:id', reviewLeaveRequest);

module.exports = router;