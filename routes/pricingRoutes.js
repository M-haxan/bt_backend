const express = require('express');
const router = express.Router();
const { addPricing, getPricing, updatePricing, deletePricing } = require('../controllers/pricingController');

// protect middleware import kiya
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .get(getPricing)
    .post(protect, addPricing);

router.route('/:id')
    .put(protect, updatePricing)
    .delete(protect, deletePricing);

module.exports = router;
