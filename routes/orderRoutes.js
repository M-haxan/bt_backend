const express = require('express');
// Import the order controller
const { createOrder, getAllOrders, getCustomerOrders, updateOrder, deleteOrder } = require('../controllers/orderController');


// Import the protect middleware
const { protect } = require('../middleware/authMiddleware');

// Create a new router
const router = express.Router();

// Define the routes
router.route('/')
    .post(protect, createOrder)
    .get(protect, getAllOrders);

router.route('/customer/:customerId')
    .get(protect, getCustomerOrders);

router.route('/:id')
    .put(protect, updateOrder)
    .delete(protect, deleteOrder);

// Export the router
module.exports = router;