const jwt = require('jsonwebtoken');
const catchAsync = require('./asyncHandler');
const User = require('../models/User');

const protect = catchAsync(async (req, res, next) => {
    let token;

    // Check if jwt exists in cookies or Bearer token in headers
    if (req.cookies && req.cookies.jwt) {
        token = req.cookies.jwt;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
        try {
            // Verify token with JWT secret
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Fetch user by decoded ID
            let user = await User.findById(decoded.id).select('-password');

            // If not admin, check worker
            if (!user) {
                const Worker = require('../models/Worker');
                user = await Worker.findById(decoded.id).select('-password');
            }

            if (!user) {
                res.status(401);
                throw new Error('User not found, authentication failed!');
            }

            req.user = user;
            next();
        } catch (error) {
            res.status(401);
            throw new Error('Not authorized, token verification failed!');
        }
    }

    // If no token provided
    if (!token) {
        res.status(401);
        throw new Error('Not authorized, no token provided!');
    }
});

module.exports = { protect };