// importing express
const express = require('express');
// importing router
const router = express.Router();
// importing controllers
const { createCustomer, getCustomers, getCustomerById, updateCustomer, deleteCustomer, updateMeasurements } = require('../controllers/customerController');
// importing protect middleware
const { protect } = require('../middleware/authMiddleware');
// creating routes
router.post('/', protect, createCustomer);
router.get('/', protect, getCustomers);
router.get('/:id', protect, getCustomerById);
router.put('/:id', protect, updateCustomer);
router.delete('/:id', protect, deleteCustomer);
router.put('/:id/measurements', protect, updateMeasurements);
// exporting router
module.exports = router;