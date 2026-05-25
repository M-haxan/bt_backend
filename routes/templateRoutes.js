//importing express
const express = require('express');
//importing router
const router = express.Router();
//importing template controllers
const { createTemplate, getTemplates, updateTemplate, deleteTemplate } = require('../controllers/templateController');
//importing protect middleware
const { protect } = require('../middleware/authMiddleware');
//creating routes
router.post('/', protect, createTemplate);
router.get('/', protect, getTemplates);
router.put('/:id', protect, updateTemplate);
router.delete('/:id', protect, deleteTemplate);
//exporting router
module.exports = router;