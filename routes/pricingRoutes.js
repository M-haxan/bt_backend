const express = require('express');
const router = express.Router();
const { addPricing, getPricing, updatePricing, deletePricing } = require('../controllers/pricingController');

// Routes
router.route('/')
    .get(getPricing)
    .post(addPricing);

router.route('/:id')
    .put(updatePricing)
    .delete(deletePricing);

module.exports = router;