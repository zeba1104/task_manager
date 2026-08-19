const mongoose = require('mongoose');//imports the Mongoose library.

const connectDB = async () => { //async function
    try {
        await mongoose.connect(process.env.MONGO_URI);//mongoose.connect() connects your application to MongoDB.
        //await waits until the connection is complete.
        //process.env.MONGO_URI gets the MongoDB connection string from the .env file.
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        process.exit(1); // stop the server if DB fails — no point running without a DB
    }
};

module.exports = connectDB;