const express = require('express');
const router = express.Router();
const {
    createWorker,
    getWorkers,
    getWorkerById,
    updateWorker,
    deleteWorker,
    getWorkerDashboard,
    markSuitAsStitched,
    adminAssignWorker
} = require('../controllers/workerController');

const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../config/cloudinary');

// Middleware to check if user is admin
const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403);
        throw new Error('Not authorized, admin privileges required');
    }
};

// Worker routes
router.get('/dashboard', protect, getWorkerDashboard);
router.put('/suits/:orderId/:suitId/stitch', protect, markSuitAsStitched);
router.put('/suits/:orderId/:suitId/assign', protect, adminOnly, adminAssignWorker);

// Admin Worker CRUD routes
router.route('/')
    .post(protect, adminOnly, upload.single('profileImage'), createWorker)
    .get(protect, getWorkers);

router.route('/:id')
    .get(protect, adminOnly, getWorkerById)
    .put(protect, adminOnly, upload.single('profileImage'), updateWorker)
    .delete(protect, adminOnly, deleteWorker);

module.exports = router;
