const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/authMiddleware');
const leaveController = require('../controllers/leaveController');
const leaveActionController = require('../controllers/leaveActionController');

const router = express.Router();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', 'uploads', 'leaveDocs');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `leave_${Date.now()}_${cleanName}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only document files (.pdf, .doc, .docx, .png, .jpg) are allowed as supporting documents.'));
    }
  },
});

// =========================================================================
// PUBLIC EMAIL ACTION ROUTES (NO LOGIN REQUIRED)
// =========================================================================
router.get('/action', leaveActionController.showLeaveActionPage);
router.post('/action/confirm', express.urlencoded({ extended: true }), express.json(), leaveActionController.confirmLeaveAction);

// =========================================================================
// PROTECTED USER / MANAGER / ADMIN LEAVE ROUTES
// =========================================================================
router.post('/apply', authMiddleware, upload.single('document'), leaveController.applyLeave);
router.get('/mine', authMiddleware, leaveController.getMyLeaves);
router.post('/:id/cancel', authMiddleware, leaveController.cancelLeave);

// Manager specific
router.get('/manager/team', authMiddleware, leaveController.getTeamLeavesForManager);

// Admin specific
router.get('/admin/all', authMiddleware, leaveController.getAllLeavesForAdmin);
router.post('/admin/:id/override', authMiddleware, leaveController.adminOverrideLeave);

module.exports = router;
