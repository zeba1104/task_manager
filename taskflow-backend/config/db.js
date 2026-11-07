const mongoose = require('mongoose');

const DEFAULT_MONGO_URI = 'mongodb+srv://zebazaveri57_db_user:12345@cluster0.gir6czu.mongodb.net/taskflow?retryWrites=true&w=majority';
let isConnected = false;

const connectDB = async () => {
    const mongoUri = process.env.MONGO_URI || DEFAULT_MONGO_URI;

    try {
        let databaseName = process.env.MONGO_DB_NAME;
        if (!databaseName) {
            try {
                const parsed = new URL(mongoUri);
                const name = parsed.pathname.slice(1).split('/')[0];
                databaseName = name ? decodeURIComponent(name) : 'taskflow';
            } catch {
                databaseName = 'taskflow';
            }
        }

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
