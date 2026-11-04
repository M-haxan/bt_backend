const express = require('express');
const router = express.Router();
const { addPricing, getPricing, updatePricing, deletePricing } = require('../controllers/pricingController');

// protect middleware import kiya
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.route('/')
    .get(getPricing)
    .post(protect, adminOnly, addPricing);

router.route('/:id')
    .put(protect, adminOnly, updatePricing)
    .delete(protect, adminOnly, deletePricing);

module.exports = router;

