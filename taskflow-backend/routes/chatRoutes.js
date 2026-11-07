const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const chatController = require('../controllers/chatController');

router.use(authMiddleware);

// Hierarchy target lookup (assigned manager for employee, admin/team for manager, managers for admin)
router.get('/hierarchy-target', chatController.getHierarchyTarget);

// Session list
router.get('/sessions', chatController.getSessions);

// Request permission to chat
router.post('/request', chatController.requestChat);

// Approve permission request
router.post('/sessions/:id/approve', chatController.approveSession);

// Reject permission request
router.post('/sessions/:id/reject', chatController.rejectSession);

// Close / conclude chat session
router.post('/sessions/:id/close', chatController.closeSession);

// Re-request permission to resume an existing session
router.post('/sessions/:id/re-request', chatController.reRequestSession);

// Re-open / resume conversation directly by manager or admin
router.post('/sessions/:id/reopen', chatController.reopenSession);

// Messages in a session
router.get('/sessions/:id/messages', chatController.getMessages);
router.post('/sessions/:id/messages', chatController.sendMessage);

module.exports = router;
