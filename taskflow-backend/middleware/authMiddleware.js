const jwt = require('jsonwebtoken');
const User = require('../models/User');

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer')) {
        return res.status(401).json({ message: 'No token provided, access denied' });
    }
    const token = authHeader.split(' ')[1];

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }

    try {
        const user = await User.findById(decoded.id).select('role isActive isSuspended');
        if (!user) return res.status(401).json({ message: 'Account no longer exists' });
        if (user.isActive === false || user.isSuspended) {
            return res.status(403).json({ message: 'This account is deactivated or suspended' });
        }
        req.userId = decoded.id;
        req.userRole = user.role || decoded.role || 'Employee';
        return next();
    } catch (error) {
        console.error('Authentication lookup failed:', error.message);
        return res.status(503).json({ message: 'Could not verify account status' });
    }
};

module.exports = verifyToken;