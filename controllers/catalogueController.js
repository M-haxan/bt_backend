const Catalogue = require('../models/Catalogue');
const { getImageMetadata, deleteUploadedImage } = require('../config/cloudinary');
const catchAsync = require('../middleware/asyncHandler');

const validCategories = ['Shalwar Qameez', 'Shirts', 'Kurta'];

const normalizeCategory = (category) => {
    if (validCategories.includes(category)) {
        return category;
    }
    return 'Shirts';
};

// 1. CREATE - Naya design upload karna
const addCatalogueItem = catchAsync(async (req, res) => {
    const { title, detail, category } = req.body;

    if (!req.file) {
        res.status(400);
        throw new Error('Image is required');
    }

    const { imageUrl, imagePublicId } = getImageMetadata(req.file);

    const newItem = new Catalogue({
        title,
        detail,
        category: normalizeCategory(category),
        imageUrl,
        imagePublicId
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

    if (item.imagePublicId) {
        await deleteUploadedImage(item.imagePublicId);
    }

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

    if (req.file) {
        if (item.imagePublicId) {
            await deleteUploadedImage(item.imagePublicId);
        }

        const { imageUrl, imagePublicId } = getImageMetadata(req.file);
        item.imageUrl = imageUrl;
        item.imagePublicId = imagePublicId;
    }

    item.title = title || item.title;
    item.detail = detail || item.detail;
    item.category = normalizeCategory(category) || item.category;

    const updatedItem = await item.save();
    res.status(200).json(updatedItem);
});

module.exports = { addCatalogueItem, getCatalogueItems, deleteCatalogueItem, updateCatalogueItem };