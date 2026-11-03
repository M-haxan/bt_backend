const express = require('express');
const router = express.Router();
const {
    getAllTailoringServices,
    createTailoringService,
    updateTailoringService,
    deleteTailoringService
} = require('../controllers/tailoringServiceController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Reading the list stays public, as it is now (the order form needs it).
router.get('/', getAllTailoringServices);

// Changing prices/services: admin only.
router.post('/', protect, adminOnly, createTailoringService);
router.put('/:id', protect, adminOnly, updateTailoringService);
router.delete('/:id', protect, adminOnly, deleteTailoringService);

module.exports = router;