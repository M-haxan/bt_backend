//importing express
const express = require('express');
//importing router
const router = express.Router();
//importing template controllers
const { createTemplate, getTemplates, updateTemplate, deleteTemplate } = require('../controllers/templateController');
//importing protect middleware
const { protect, adminOnly } = require('../middleware/authMiddleware');
//creating routes
router.post('/', protect, adminOnly, createTemplate);
router.get('/', protect, getTemplates);
router.put('/:id', protect, adminOnly, updateTemplate);
router.delete('/:id', protect, adminOnly, deleteTemplate);
//exporting router
module.exports = router;