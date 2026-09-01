const express = require('express');
const router = express.Router();
const {
    createWorker,
    getWorkers,
    getWorkerById,
    updateWorker,
    deleteWorker,
    getWorkerDashboard,
    submitSuitForInspection,
    adminApproveSuit,
    adminRejectSuit,
    adminAssignStage,
    getFinancialSummary,
    markSuitAsStitched,
    adminAssignWorker,
    getWorkerLedger,
    addWorkerAdvance,
    calculateWorkerSalary,
    payWorkerSalary,
    getWorkerPayments,
    getWorkerDetails,
    updateLedgerEntry,
    deleteLedgerEntry
} = require('../controllers/workerController');

const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');

// Middleware to check if user is admin
const adminOnly = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role !== 'worker')) {
        next();
    } else {
        res.status(403);
        throw new Error('Not authorized, admin privileges required');
    }
};

// Worker & QC routes
router.get('/dashboard', protect, getWorkerDashboard);
router.get('/analytics/financial-summary', protect, adminOnly, getFinancialSummary);
router.put('/suits/:orderId/:suitId/submit', protect, submitSuitForInspection);
router.put('/suits/:orderId/:suitId/approve', protect, adminOnly, adminApproveSuit);
router.put('/suits/:orderId/:suitId/reject', protect, adminOnly, adminRejectSuit);
router.put('/suits/:orderId/:suitId/stitch', protect, markSuitAsStitched);
router.put('/suits/:orderId/:suitId/assign', protect, adminOnly, adminAssignWorker);
router.put('/suits/:orderId/:suitId/assign-stage', protect, adminOnly, adminAssignStage);

// Ledger & Salary routes
router.get('/:id/ledger', protect, getWorkerLedger);
router.post('/:id/advance', protect, adminOnly, addWorkerAdvance);
router.get('/:id/calculate-salary', protect, adminOnly, calculateWorkerSalary);
router.post('/:id/pay-salary', protect, adminOnly, payWorkerSalary);
router.get('/:id/payments', protect, getWorkerPayments);
router.get('/:id/details', protect, adminOnly, getWorkerDetails);

// Ledger Entry CRUD routes (Admin only)
router.put('/ledger/:ledgerId', protect, adminOnly, updateLedgerEntry);
router.delete('/ledger/:ledgerId', protect, adminOnly, deleteLedgerEntry);

// Admin Worker CRUD routes
router.route('/')
    .post(protect, adminOnly, upload.single('profileImage'), createWorker)
    .get(protect, getWorkers);

router.route('/:id')
    .get(protect, adminOnly, getWorkerById)
    .put(protect, adminOnly, upload.single('profileImage'), updateWorker)
    .delete(protect, adminOnly, deleteWorker);

module.exports = router;
