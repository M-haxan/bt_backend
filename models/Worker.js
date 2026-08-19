const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const workerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    phone: {
        type: Number,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    profileImage: {
        url: { type: String },
        public_id: { type: String }
    },
    perSuitWage: {
        type: Number,
        required: true,
        default: 0
    },
    advanceAmount: {
        type: Number,
        required: true,
        default: 0
    },
    specialization: {
        type: String,
        enum: ['Kameez Stitcher', 'Complete Suit Stitcher', 'Cutter', 'Helper'],
        default: 'Complete Suit Stitcher'
    },
    address: {
        type: String
    },
    role: {
        type: String,
        default: 'worker'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Hash password before saving
workerSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare password
workerSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Worker', workerSchema);
