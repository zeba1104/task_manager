const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        console.error('MONGO_URI is not defined in environment variables.');
        return;
    }

    try {
        const uriDatabase = new URL(mongoUri).pathname.slice(1).split('/')[0];
        const databaseName = process.env.MONGO_DB_NAME || decodeURIComponent(uriDatabase || 'taskflow');

        await mongoose.connect(mongoUri, {
            dbName: databaseName,
            serverSelectionTimeoutMS: 6000,
        });
        isConnected = true;
        console.log('MongoDB connected successfully');
    } catch (error) {
        isConnected = false;
        console.error('MongoDB Atlas connection failed:', error.message);
        console.log('Retrying MongoDB connection in 6 seconds...');
        setTimeout(connectDB, 6000);
    }
};

mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.log('MongoDB disconnected. Retrying...');
    setTimeout(connectDB, 6000);
});

mongoose.connection.on('connected', () => {
    isConnected = true;
});

module.exports = connectDB;
