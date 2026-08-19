const express = require('express');
const router = express.Router();
const { clockIn, clockOut, getAttendance } = require('../controllers/attendanceController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/in', clockIn);
router.post('/out', clockOut);
router.get('/', getAttendance);

module.exports = router;
