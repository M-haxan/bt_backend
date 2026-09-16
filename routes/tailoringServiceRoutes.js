const express = require('express');
const router = express.Router();
const { 
    getAllTailoringServices,
    createTailoringService,
    updateTailoringService,
    deleteTailoringService
} = require('../controllers/tailoringServiceController');

// All standard endpoints for internal tailoring services / customizations
router.route('/')
    .get(getAllTailoringServices)
    .post(createTailoringService);

router.route('/:id')
    .put(updateTailoringService)
    .delete(deleteTailoringService);

module.exports = router;
