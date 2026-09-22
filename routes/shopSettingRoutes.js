const express = require('express');
const router = express.Router();
const { getShopSettings, updateShopSettings } = require('../controllers/shopSettingController');
const { upload } = require('../config/cloudinary');
const { protect } = require('../middleware/authMiddleware');

// Public route to fetch shop branding (used by website header, invoices, preloader)
router.get('/shop', getShopSettings);

// Protected route to update shop branding & logo (Admin only)
router.put('/shop', protect, upload.single('logo'), updateShopSettings);

module.exports = router;
