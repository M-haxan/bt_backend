const express = require('express');
const router = express.Router();
const {
    createCustomer,
    getCustomers,
    getCustomerById,
    getCustomerProfile,
    updateCustomer,
    deleteCustomer,
    updateMeasurements,
    deleteMeasurementCategory,
    getCustomerLedger,
    settleCustomerKhata,
    getCustomerKhataBalance
} = require('../controllers/customerController');
const { protect, adminOnly, requirePermission } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');

// Reading customers: admin, or a worker allowed to book OR deliver
router.get('/', protect, requirePermission('canCreateOrder', 'canDeliverOrder'), getCustomers);
router.get('/khata/:identifier', protect, adminOnly, requirePermission('canCreateOrder', 'canDeliverOrder'), getCustomerKhataBalance);
router.get('/:id', protect, requirePermission('canCreateOrder', 'canDeliverOrder'), getCustomerById);

// Creating customers and saving measurements: only workers allowed to book
router.post('/', protect, requirePermission('canCreateOrder'), upload.single('profileImage'), createCustomer);
router.put('/:id/measurements', protect, requirePermission('canCreateOrder'), updateMeasurements);

// Money records, full profile, editing, deleting: admin only
router.get('/:id/profile', protect, adminOnly, getCustomerProfile);
router.get('/:id/ledger', protect, adminOnly, getCustomerLedger);
router.post('/:id/settle', protect, adminOnly, settleCustomerKhata);
router.put('/:id', protect, adminOnly, upload.single('profileImage'), updateCustomer);
router.delete('/:id', protect, adminOnly, deleteCustomer);
router.delete('/:id/measurements/:category', protect, adminOnly, deleteMeasurementCategory);

module.exports = router;