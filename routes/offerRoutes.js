const express = require('express');
const router = express.Router();
const {
    getOffers,
    addOffer,
    updateOffer,
    deleteOffer
} = require('../controllers/offerController');
const { upload } = require('../config/cloudinary');
const { protect } = require('../middleware/authMiddleware');

// Public route to view offers on landing page
router.get('/', getOffers);

// Protected routes for Admin management
router.post('/', protect, upload.single('image'), addOffer);
router.put('/:id', protect, upload.single('image'), updateOffer);
router.delete('/:id', protect, deleteOffer);

module.exports = router;
