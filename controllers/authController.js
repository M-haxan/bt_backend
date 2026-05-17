const User = require('../models/User');
const jwt = require('jsonwebtoken');
const catchAsync = require('../middleware/asyncHandler');

// Token Generate karne ka function
const generateToken = (id) => {
    // Token 30 din tak valid rahega
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// 1. REGISTER ADMIN (Ek dafa chalega)
const registerAdmin = catchAsync(async (req, res) => {
    const { name, email, password } = req.body;

    // SECURITY CHECK: Dekho kya database mein pehle se koi admin hai?
    const adminExists = await User.countDocuments();
    if (adminExists >= 1) {
        res.status(403); // Forbidden
        throw new Error('Admin pehle se mojood hai. Mazeed signups allowed nahi hain.');
    }

    const user = await User.create({
        name,
        email,
        password
    });

    if (user) {
        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user._id)
        });
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
});

// 2. LOGIN ADMIN
const loginAdmin = catchAsync(async (req, res) => {
    const { email, password } = req.body;

    // Email se user dhoondo
    const user = await User.findOne({ email });

    // Agar user mil jaye aur password match kar jaye
    if (user && (await user.matchPassword(password))) {
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user._id)
        });
    } else {
        res.status(401); // Unauthorized
        throw new Error('Email ya password galat hai');
    }
});

module.exports = { registerAdmin, loginAdmin };