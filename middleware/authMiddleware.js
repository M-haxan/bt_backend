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
            // Check 1: a deactivated worker is rejected immediately
            if (user.isActive === false) {
                res.status(401);
                throw new Error('Account is deactivated. Please contact admin.');
            }

            // Check 2: token was issued before the last password change / forced logout
            if ((decoded.tv || 0) !== (user.tokenVersion || 0)) {
                res.status(401);
                throw new Error('Session expired. Please log in again.');
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
    // Allows the request only if the logged-in user is an admin.
// Must be used AFTER `protect`, because it relies on req.user.


});
const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    res.status(403);
    throw new Error('Access denied: admin privileges required');
};
const requirePermission = (...permissionNames) => (req, res, next) => {
    if (!req.user) {
        res.status(401);
        throw new Error('Not authorized');
    }

    if (req.user.role === 'admin') {
        return next();
    }

    const hasPermission = permissionNames.some((name) => req.user[name] === true);
    if (hasPermission) {
        return next();
    }

    res.status(403);
    throw new Error('You do not have permission to perform this action');
};

module.exports = { protect, adminOnly, requirePermission };