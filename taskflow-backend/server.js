require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const userRoutes = require('./routes/userRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const focusRoutes = require('./routes/focusRoutes');
const adminRoutes = require('./routes/adminRoutes');
const managerRoutes = require('./routes/managerRoutes');

const app = express();

// Middleware
app.use(cors());          // allow cross-origin requests (needed for React frontend later)
app.use(express.json());  // parses incoming JSON request bodies into req.body



app.use('/api/auth', authRoutes);
app.use('/api/task', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/focus', focusRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/manager', managerRoutes);
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Server startup failed: MongoDB connection could not be established.', error.message);
        process.exitCode = 1;
    }
};

startServer();