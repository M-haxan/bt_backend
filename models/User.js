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
        required: true,
        select: false  // Password database mein dikhega nahi     
    },
    tokenVersion: {
        type: Number,
        default: 0
    },
    role: {
        type: String,
        enum: ['admin', 'worker'],
        default: 'worker' // Automatic role admin
    },
    resetPasswordToken: {
        type: String
    },
    resetPasswordExpires: {
        type: Date
    }
}, {
    timestamps: true,
    toJSON: {
        
        // Runs whenever a User is sent with res.json(). Removes secret fields.
        
        transform(doc, ret) {
            delete ret.tokenVersion;
            delete ret.password;
            delete ret.resetPasswordToken;
            delete ret.resetPasswordExpires;
            return ret;
        }
    }
});
// Password save hone se pehle usko Encrypt (Hash) karna
userSchema.pre('save', async function () {
    // Agar password change nahi hua toh aage barh jao
    if (!this.isModified('password')) {
        return;
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