const express = require('express');
const router = express.Router();
const { startFocusSession, stopFocusSession, getFocusSessions } = require('../controllers/focusController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/start', startFocusSession);
router.post('/stop', stopFocusSession);
router.get('/', getFocusSessions);

module.exports = router;
