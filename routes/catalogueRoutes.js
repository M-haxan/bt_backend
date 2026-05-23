const express = require('express');
const router = express.Router();
const { getCatalogueItems, addCatalogueItem, deleteCatalogueItem, updateCatalogueItem } = require('../controllers/catalogueController');
const { upload } = require('../config/cloudinary');

// Naya Code: protect middleware import kiya
const { protect } = require('../middleware/authMiddleware'); 

// GET public hai (Aam user site par designs dekh sakta hai)
router.get('/', getCatalogueItems);

// POST aur DELETE par protect laga diya (Sirf Admin kar sakta hai)
router.post('/', protect, upload.single('image'), addCatalogueItem); 
router.put('/:id', protect, upload.single('image'), updateCatalogueItem);
router.delete('/:id', protect, deleteCatalogueItem);

module.exports = router;