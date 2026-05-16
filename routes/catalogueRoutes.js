const express = require('express');
const router = express.Router();
const { getCatalogueItems, addCatalogueItem, deleteCatalogueItem } = require('../controllers/catalogueController');
const { upload } = require('../config/cloudinary');

// Raste (Routes)
router.get('/', getCatalogueItems);

// 'image' us field ka naam hai jo frontend se form data mein aayega
router.post('/', upload.single('image'), addCatalogueItem); 

router.delete('/:id', deleteCatalogueItem);

module.exports = router;