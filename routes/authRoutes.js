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
    resetPassword
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Route: POST /api/auth/register
// Kaam: Naya admin banana
router.post('/register', registerAdmin);

// Route: POST /api/auth/login
// Kaam: Admin login karna aur Token (JWT) lena
router.post('/login', loginAdmin);

// Route: POST /api/auth/forgot-password
// Kaam: Password reset link email karna
router.post('/forgot-password', forgotPassword);

// Route: POST /api/auth/reset-password/:token
// Kaam: Naya password verify kar ke save karna
router.post('/reset-password/:token', resetPassword);

// Route: POST /api/auth/worker-login
// Kaam: Worker login karna aur Token (JWT) lena
router.post('/worker-login', loginWorker);

// Route: POST /api/auth/logout
// Kaam: Admin logout karna aur Token (cookie) clear karna
router.post('/logout', logoutAdmin);

// Profile routes (Protected)
router.route('/profile')
    .get(protect, getAdminProfile)
    .put(protect, updateAdminProfile);

module.exports = router;