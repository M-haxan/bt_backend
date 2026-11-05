const jwt = require('jsonwebtoken');
const catchAsync = require('./asyncHandler');
const User = require('../models/User');
const Session = require('../models/Session');

const protect = catchAsync(async (req, res, next) => {
    // Access token comes ONLY from the Authorization header now
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        res.status(401);
        throw new Error('Not authorized, no token provided!');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // The session behind this token must still exist (logout deletes it)
        const sessionActive = decoded.sid && await Session.exists({
            _id: decoded.sid,
            expiresAt: { $gt: new Date() }
        });
        if (!sessionActive) {
            res.status(401);
            throw new Error('Session ended. Please log in again.');
        }

        let user = await User.findById(decoded.id).select('-password');
        if (!user) {
            const Worker = require('../models/Worker');
            user = await Worker.findById(decoded.id).select('-password');
        }
        if (!user) {
            res.status(401);
            throw new Error('User not found, authentication failed!');
        }

        // Deactivated workers are rejected immediately
        if (user.isActive === false) {
            res.status(401);
            throw new Error('Account is deactivated. Please contact admin.');
        }

        // Extra safety net from the previous step
        if ((decoded.tv || 0) !== (user.tokenVersion || 0)) {
            res.status(401);
            throw new Error('Session expired. Please log in again.');
        }

        req.user = user;
        req.sessionId = decoded.sid;
        next();
    } catch (error) {
        res.status(401);
        throw new Error('Not authorized, token verification failed!');
    }
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