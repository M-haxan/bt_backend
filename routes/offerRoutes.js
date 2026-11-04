const express = require('express');
const router = express.Router();
const {
    getOffers,
    addOffer,
    updateOffer,
    deleteOffer
} = require('../controllers/offerController');
const { upload } = require('../config/cloudinary');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Public route to view offers on landing page
router.get('/', getOffers);

// Protected routes for Admin management
router.post('/', protect, adminOnly, upload.single('image'), addOffer);
router.put('/:id', protect, adminOnly, upload.single('image'), updateOffer);
router.delete('/:id', protect, adminOnly, deleteOffer);

module.exports = router;
