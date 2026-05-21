const User = require('../models/User');
const jwt = require('jsonwebtoken');
const catchAsync = require('../middleware/asyncHandler');

// Token Generate aur Cookie set karne ka function
const generateToken = (res, id) => {
    // Token 30 din tak valid rahega
    const token = jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    // Set JWT as HTTP-Only Cookie
    res.cookie('jwt', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development', // Use secure cookies in production
        sameSite: 'none', // Prevent CSRF attacks
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
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
        generateToken(res, user._id);

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
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
        generateToken(res, user._id);

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        });
    } else {
        res.status(401); // Unauthorized
        throw new Error('Email ya password galat hai');
    }
});

// 3. LOGOUT ADMIN
const logoutAdmin = catchAsync(async (req, res) => {
    res.cookie('jwt', '', {
        httpOnly: true,
        expires: new Date(0)
    });

    res.status(200).json({ message: 'Logged out successfully' });
});

module.exports = { registerAdmin, loginAdmin, logoutAdmin };