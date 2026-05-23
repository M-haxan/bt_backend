const Catalogue = require('../models/Catalogue');
const { cloudinary } = require('../config/cloudinary');
const catchAsync = require('../middleware/asyncHandler'); // Wrapper import kiya

// 1. CREATE - Naya design upload karna
const addCatalogueItem = catchAsync(async (req, res) => {
    const { title, detail, category } = req.body;
    
    // Agar image nahi hai, toh seedha error throw karo (Global handler pakad lega)
    if (!req.file) {
        res.status(400); // Bad Request
        throw new Error('Image is required');
    }

    const newItem = new Catalogue({
        title,
        detail,
        category,
        imageUrl: req.file.path,
        imagePublicId: req.file.filename
    });

    const savedItem = await newItem.save();
    res.status(201).json(savedItem);
});

// 2. READ - Sab items dekhna
const getCatalogueItems = catchAsync(async (req, res) => {
    const items = await Catalogue.find().sort({ createdAt: -1 });
    res.status(200).json(items);
});

// 3. DELETE - Item delete karna
const deleteCatalogueItem = catchAsync(async (req, res) => {
    const item = await Catalogue.findById(req.params.id);
    
    if (!item) {
        res.status(404); // Not Found
        throw new Error('Item not found');
    }

    await cloudinary.uploader.destroy(item.imagePublicId);
    await item.deleteOne();
    
    res.status(200).json({ message: 'Item deleted successfully' });
});

// 4. UPDATE - Item edit karna
const updateCatalogueItem = catchAsync(async (req, res) => {
    const { title, detail, category } = req.body;
    const item = await Catalogue.findById(req.params.id);

    if (!item) {
        res.status(404); // Not Found
        throw new Error('Item not found');
    }

    // Agar nayi image upload hui hai
    if (req.file) {
        // Purani image cloudinary se delete karo
        if (item.imagePublicId) {
            await cloudinary.uploader.destroy(item.imagePublicId);
        }
        item.imageUrl = req.file.path;
        item.imagePublicId = req.file.filename;
    }

    item.title = title || item.title;
    item.detail = detail || item.detail;
    item.category = category || item.category;

    const updatedItem = await item.save();
    res.status(200).json(updatedItem);
});

module.exports = { addCatalogueItem, getCatalogueItems, deleteCatalogueItem, updateCatalogueItem };