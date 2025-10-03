// config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('MONGO_URI:', process.env.MONGO_URI); // Debug line
    
    // Try local MongoDB first, then fallback to cloud
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sparklewash';
    
    const conn = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('MongoDB connection error:', err);
    // Try to connect to local MongoDB as fallback
    try {
      console.log('Trying local MongoDB...');
      const conn = await mongoose.connect('mongodb://127.0.0.1:27017/sparklewash', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log(`MongoDB connected (local): ${conn.connection.host}`);
    } catch (localErr) {
      console.error('Local MongoDB also failed:', localErr);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
