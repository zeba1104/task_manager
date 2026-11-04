const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
	getOverview,
	getProfile,
	updateProfile,
	changePassword,
	createProfileChangeRequest,
} = require('../controllers/managerController');

const router = express.Router();
router.use(authMiddleware);
router.get('/overview', getOverview);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/password', changePassword);
router.post('/profile-change-requests', createProfileChangeRequest);

module.exports = router;