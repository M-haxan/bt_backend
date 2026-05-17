const express = require('express');
const router = express.Router();
const { registerAdmin, loginAdmin } = require('../controllers/authController');

// Route: POST /api/auth/register
// Kaam: Naya admin banana (Sirf ek dafa chalega)
router.post('/register', registerAdmin);

// Route: POST /api/auth/login
// Kaam: Admin login karna aur Token (JWT) lena
router.post('/login', loginAdmin);

module.exports = router;