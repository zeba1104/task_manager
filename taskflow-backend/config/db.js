const mongoose = require('mongoose');

const connectDB = async () => {
    const mongoUri = process.env.MONGO_URI;
    const uriDatabase = new URL(mongoUri).pathname.slice(1).split('/')[0];
    const databaseName = process.env.MONGO_DB_NAME || decodeURIComponent(uriDatabase || 'taskflow');

    await mongoose.connect(mongoUri, { dbName: databaseName });
    console.log('MongoDB connected successfully');
};

module.exports = connectDB;