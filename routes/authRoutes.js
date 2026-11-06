const express = require('express');
const router = express.Router();
const { 
    registerAdmin, 
    loginAdmin, 
    logoutAdmin, 
    loginWorker,
    getAdminProfile,
    updateAdminProfile,
    forgotPassword,
    resetPassword,
    refreshAccessToken
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const {
    loginLimiter,
    accountLoginLimiter,
    forgotPasswordLimiter,
    sensitiveLimiter,
    refreshLimiter
} = require('../middleware/rateLimiters');

// Route: POST /api/auth/register
// Kaam: Naya admin banana
router.post('/register', sensitiveLimiter, registerAdmin);
router.post('/login', loginLimiter, accountLoginLimiter, loginAdmin);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password/:token', sensitiveLimiter, resetPassword);
router.post('/worker-login', loginLimiter, accountLoginLimiter, loginWorker);
router.post('/refresh', refreshLimiter, refreshAccessToken);   
// Route: POST /api/auth/logout
// Kaam: Admin logout karna aur Token (cookie) clear karna
router.post('/logout', logoutAdmin);

// Profile routes (Protected)
router.route('/profile')
    .get(protect, getAdminProfile)
    .put(protect, updateAdminProfile);

module.exports = router;