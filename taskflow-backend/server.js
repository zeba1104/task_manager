require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const userRoutes = require('./routes/userRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');

const app = express();

// Connect to database
connectDB();

// Middleware
app.use(cors());          // allow cross-origin requests (needed for React frontend later)
app.use(express.json());  // parses incoming JSON request bodies into req.body

// Test route
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running fine' });
});

app.use('/api/auth', authRoutes);
app.use('/api/task', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});