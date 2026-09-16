const TailoringService = require('../models/TailoringService');
const catchAsync = require('../middleware/asyncHandler');

// 1. GET ALL SERVICES & CUSTOMIZATIONS
const getAllTailoringServices = catchAsync(async (req, res) => {
    const services = await TailoringService.find().sort({ itemType: -1, createdAt: 1 });
    res.status(200).json(services);
});

// 2. CREATE NEW SERVICE OR CUSTOMIZATION
const createTailoringService = catchAsync(async (req, res) => {
    const { itemType, serviceName, price } = req.body;

    if (!serviceName || price === undefined) {
        res.status(400);
        throw new Error('Name and Price are required.');
    }

    const newService = await TailoringService.create({
        itemType: itemType === 'customization' ? 'customization' : 'service',
        serviceName: serviceName.trim(),
        price: Number(price) || 0
    });

    res.status(201).json(newService);
});

// 3. UPDATE SERVICE OR CUSTOMIZATION
const updateTailoringService = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { itemType, serviceName, price, isActive } = req.body;

    const updated = await TailoringService.findByIdAndUpdate(
        id,
        {
            ...(itemType && { itemType }),
            ...(serviceName && { serviceName: serviceName.trim() }),
            ...(price !== undefined && { price: Number(price) }),
            ...(isActive !== undefined && { isActive })
        },
        { new: true, runValidators: true }
    );

    if (!updated) {
        res.status(404);
        throw new Error('Tailoring service not found.');
    }

    res.status(200).json(updated);
});

// 4. DELETE SERVICE OR CUSTOMIZATION
const deleteTailoringService = catchAsync(async (req, res) => {
    const { id } = req.params;
    const deleted = await TailoringService.findByIdAndDelete(id);

    if (!deleted) {
        res.status(404);
        throw new Error('Tailoring service not found.');
    }

    res.status(200).json({ message: 'Tailoring service removed successfully.' });
});

module.exports = {
    getAllTailoringServices,
    createTailoringService,
    updateTailoringService,
    deleteTailoringService
};
