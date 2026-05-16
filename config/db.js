const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // .env file se uri le kar database se connect hone ki koshish
        const conn = await mongoose.connect(process.env.MONGO_URI);
        
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        process.exit(1); // Agar connection fail ho jaye toh process ko band kar do
    }
};

module.exports = connectDB;