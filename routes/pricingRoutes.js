const express = require('express');
const router = express.Router();
const { addPricing, getPricing, updatePricing, deletePricing } = require('../controllers/pricingController');

// Naya Code: protect middleware import kiya
const { protect } = require('../middleware/authMiddleware');

// GET ko protect nahi kiya taake website par prices nazar aayen
router.route('/')
    .get(getPricing)
    .post(protect, addPricing); // POST par protect lagaya

// ID wale routes par protect lagaya
router.route('/:id')
    .put(protect, updatePricing)
    .delete(protect, deletePricing);

module.exports = router;