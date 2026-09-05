const express = require('express');
const router = express.Router();
const {
    createSupplier,
    getSuppliers,
    getSupplierLedger,
    addSupplierPurchase,
    settleSupplierPayment,
    deleteSupplier,
    createDirectExpense,
    getExpenses,
    deleteExpense
} = require('../controllers/expenseController');
const { protect } = require('../middleware/authMiddleware');

// Public or Protected - Protect when in production or standard admin
router.post('/suppliers', createSupplier);
router.get('/suppliers', getSuppliers);
router.get('/suppliers/:id/ledger', getSupplierLedger);
router.post('/suppliers/:id/purchase', addSupplierPurchase);
router.post('/suppliers/:id/pay', settleSupplierPayment);
router.delete('/suppliers/:id', deleteSupplier);

router.post('/direct', createDirectExpense);
router.get('/', getExpenses);
router.delete('/:id', deleteExpense);

module.exports = router;
