const FocusSession = require('../models/FocusSession');

exports.startFocusSession = async (req, res) => {
    try {
        const { taskId } = req.body;
        const session = await FocusSession.create({
            user: req.userId,
            task: taskId,
            startTime: new Date()
        });
        res.status(201).json(session);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.stopFocusSession = async (req, res) => {
    try {
        const { sessionId, durationSeconds } = req.body;
        const session = await FocusSession.findOneAndUpdate(
            { _id: sessionId, user: req.userId },
            { endTime: new Date(), durationSeconds },
            { new: true }
        );
        if (!session) return res.status(404).json({ message: 'Session not found' });
        res.json(session);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getFocusSessions = async (req, res) => {
    try {
        const query = { user: req.userId };
        
        // If query params are provided for date filtering
        if (req.query.date) {
            const date = new Date(req.query.date);
            const nextDay = new Date(date);
            nextDay.setDate(nextDay.getDate() + 1);
            query.startTime = { $gte: date, $lt: nextDay };
        }

        const sessions = await FocusSession.find(query)
            .populate('task', 'title priority deadline status')
            .sort({ startTime: -1 });
            
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
