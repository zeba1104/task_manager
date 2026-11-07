const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

// Production fallbacks so backend starts seamlessly anywhere
process.env.JWT_SECRET = process.env.JWT_SECRET || 'taskflow-super-secure-production-jwt-token-secret-2026';
process.env.SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
process.env.SMTP_PORT = process.env.SMTP_PORT || '587';
process.env.SMTP_USER = process.env.SMTP_USER || 'zeba.zaveri57@gmail.com';
process.env.SMTP_PASS = process.env.SMTP_PASS || 'ehdtrovkbrbyjhwr';
process.env.MAIL_FROM = process.env.MAIL_FROM || 'Taskflow <zeba.zaveri57@gmail.com>';

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const userRoutes = require('./routes/userRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const focusRoutes = require('./routes/focusRoutes');
const adminRoutes = require('./routes/adminRoutes');
const managerRoutes = require('./routes/managerRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const chatRoutes = require('./routes/chatRoutes');

const app = express();

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());  // parses incoming JSON request bodies into req.body
app.use(express.urlencoded({ extended: true })); // parses incoming form-urlencoded data for email action pages
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Root & Health check routes
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'taskflow-backend',
        dbReady: mongoose.connection.readyState === 1,
        message: 'Taskflow API is running live'
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'taskflow-backend',
        dbReady: mongoose.connection.readyState === 1
    });
});

// DB check middleware
app.use((req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
            message: 'Database connection in progress. Please ensure IP 42.104.235.4 (or 0.0.0.0/0) is whitelisted in your MongoDB Atlas Network Access.',
            dbReady: false,
        });
    }
    next();
});

app.use('/api/auth', authRoutes);
app.use('/api/task', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/focus', focusRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/chat', chatRoutes);

const PORT = process.env.PORT || 5000;

const startServer = () => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
    });
    connectDB();
};

startServer();
