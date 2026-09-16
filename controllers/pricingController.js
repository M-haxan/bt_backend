const Pricing = require('../models/Pricing');
const catchAsync = require('../middleware/asyncHandler');

// 1. GET ALL PUBLIC PRICING CARDS
const getPricing = catchAsync(async (req, res) => {
    const pricingList = await Pricing.find().sort({ createdAt: 1 });
    res.status(200).json(pricingList);
});

// 2. CREATE NEW PRICING CARD
const addPricing = catchAsync(async (req, res) => {
    const { serviceName, description, minPrice, maxPrice, deliveryTime } = req.body;

    if (!serviceName || minPrice === undefined || maxPrice === undefined) {
        res.status(400);
        throw new Error('Service Name, Min Price, and Max Price are required.');
    }

    const newPricing = await Pricing.create({
        serviceName: serviceName.trim(),
        description: description?.trim() || '',
        minPrice: Number(minPrice),
        maxPrice: Number(maxPrice),
        deliveryTime: deliveryTime?.trim() || 'Standard (3-5 Days)'
    });

    res.status(201).json(newPricing);
});

// 3. UPDATE PRICING CARD
const updatePricing = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { serviceName, description, minPrice, maxPrice, deliveryTime } = req.body;

    const updated = await Pricing.findByIdAndUpdate(
        id,
        {
            ...(serviceName && { serviceName: serviceName.trim() }),
            ...(description !== undefined && { description: description.trim() }),
            ...(minPrice !== undefined && { minPrice: Number(minPrice) }),
            ...(maxPrice !== undefined && { maxPrice: Number(maxPrice) }),
            ...(deliveryTime !== undefined && { deliveryTime: deliveryTime.trim() })
        },
        { new: true, runValidators: true }
    );

    if (!updated) {
        res.status(404);
        throw new Error('Pricing card not found.');
    }

    res.status(200).json(updated);
});

// 4. DELETE PRICING CARD
const deletePricing = catchAsync(async (req, res) => {
    const { id } = req.params;
    const deleted = await Pricing.findByIdAndDelete(id);

    if (!deleted) {
        res.status(404);
        throw new Error('Pricing card not found.');
    }

    res.status(200).json({ message: 'Pricing card deleted successfully.' });
});

module.exports = {
    getPricing,
    addPricing,
    updatePricing,
    deletePricing
};