const express = require('express');
const router = express.Router();
const { registerAdmin, loginAdmin, logoutAdmin } = require('../controllers/authController');

// Route: POST /api/auth/register
// Kaam: Naya admin banana (Sirf ek dafa chalega)
router.post('/register', registerAdmin);

// Route: POST /api/auth/login
// Kaam: Admin login karna aur Token (JWT) lena
router.post('/login', loginAdmin);

// Route: POST /api/auth/logout
// Kaam: Admin logout karna aur Token (cookie) clear karna
router.post('/logout', logoutAdmin);

module.exports = router;