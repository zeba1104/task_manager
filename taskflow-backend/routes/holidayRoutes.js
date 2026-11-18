const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  getHolidays,
  getUpcomingHoliday,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} = require('../controllers/holidayController');

// All holiday routes require authentication
router.use(authMiddleware);

// Admin check middleware for write operations
const requireAdmin = (req, res, next) => {
  if (req.userRole !== 'Admin') {
    return res.status(403).json({ message: 'Only administrators can manage company and government holidays.' });
  }
  next();
};

// Read routes (available to Admin, Manager, and Employee)
router.get('/', getHolidays);
router.get('/upcoming', getUpcomingHoliday);

// Admin-only management routes
router.post('/', requireAdmin, createHoliday);
router.put('/:id', requireAdmin, updateHoliday);
router.delete('/:id', requireAdmin, deleteHoliday);

module.exports = router;
