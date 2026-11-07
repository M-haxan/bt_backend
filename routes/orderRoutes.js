const express = require('express');
const {
    createOrder,
    getAllOrders,
    getOrderById,
    getCustomerOrders,
    updateOrder,
    deleteOrder,
    trackOrderPublic,
    updateOrderStatus,
    deliverOrder
} = require('../controllers/orderController');
const { trackLimiter } = require('../middleware/rateLimiters');

const { upload } = require('../config/cloudinary');
const { protect, adminOnly, requirePermission } = require('../middleware/authMiddleware');

const router = express.Router();

// Public customer tracking (order number + last 4 digits of phone)
router.get('/track/:orderNumber', trackLimiter, trackOrderPublic);

// Order status only (admin)
router.put('/:id/status', protect, adminOnly, updateOrderStatus);

// Deliver: admin, or worker with delivery permission
router.put('/:id/deliver', protect, requirePermission('canDeliverOrder'), deliverOrder);

router.route('/')
    // Book order: admin, or worker with booking permission
    .post(protect, requirePermission('canCreateOrder'), upload.array('fabricImages', 10), createOrder)
    // View/search orders: admin, or worker who books or delivers
    .get(protect, requirePermission('canCreateOrder', 'canDeliverOrder'), getAllOrders);

router.route('/customer/:customerId')
    .get(protect, requirePermission('canCreateOrder', 'canDeliverOrder'), getCustomerOrders);

router.route('/:id')
    .get(protect, requirePermission('canCreateOrder', 'canDeliverOrder'), getOrderById)
    .put(protect, requirePermission('canCreateOrder'), upload.array('fabricImages', 10), updateOrder)
    .delete(protect, adminOnly, deleteOrder);

module.exports = router;