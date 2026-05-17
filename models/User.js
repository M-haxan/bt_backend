const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        default: 'admin' // Automatic role admin
    }
}, { timestamps: true });

// Password save hone se pehle usko Encrypt (Hash) karna
userSchema.pre('save', async function (next) {
    // Agar password change nahi hua toh aage barh jao
    if (!this.isModified('password')) {
        next();
    }
    // Password ko secure banane ka process
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Password check karne ka function (Login ke waqt kaam aayega)
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);