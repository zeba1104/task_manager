const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer')) {
        return res.status(401).json({ message: 'No token provided, access denied' });
    }
    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.id;
        req.userRole = decoded.role || 'Employee';
        next();
    } catch (error) {
  console.log('TOKEN RECEIVED:', token);
  console.log('JWT_SECRET BEING USED:', process.env.JWT_SECRET);
  console.log('ERROR:', error.message);
  return res.status(401).json({ message: 'Invalid or expired token' });
}

};

module.exports = verifyToken;