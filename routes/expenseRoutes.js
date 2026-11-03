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
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Every route in this file requires: logged in AND admin.
// router.use(...) applies these two checks to all routes defined below it.
router.use(protect, adminOnly);

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