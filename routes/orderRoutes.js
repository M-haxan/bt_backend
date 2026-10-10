const express = require('express');
// Import the order controller
const { 
    createOrder, 
    getAllOrders, 
    getOrderById,
    getCustomerOrders, 
    updateOrder, 
    deleteOrder,
    trackOrderPublic,
    trackSuitPublic,
    deliverOrder
} = require('../controllers/orderController');

const { upload } = require('../config/cloudinary');
// Import the protect middleware
const { protect } = require('../middleware/authMiddleware');

// Create a new router
const router = express.Router();

// Public Tracking routes (unprotected)
router.get('/track/:orderNumber', trackOrderPublic);
router.get('/track/suit/:suitId', trackSuitPublic);

// Delivery & Payment Settle route
router.put('/:id/deliver', protect, deliverOrder);

// Define the routes
router.route('/')
    .post(protect, upload.array('fabricImages', 10), createOrder)
    .get(protect, getAllOrders);

router.route('/customer/:customerId')
    .get(protect, getCustomerOrders);

router.route('/:id')
    .get(protect, getOrderById)
    .put(protect, upload.array('fabricImages', 10), updateOrder)
    .delete(protect, deleteOrder);

// Export the router
module.exports = router;