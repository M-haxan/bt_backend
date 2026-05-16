const Pricing = require('../models/Pricing');
const catchAsync = require('../middleware/asyncHandler');

// 1. CREATE - Naya Rate aur Description Add Karna
const addPricing = catchAsync(async (req, res) => {
    const { serviceName, description, minPrice, maxPrice, deliveryTime } = req.body;

    if (!serviceName || !minPrice || !maxPrice) {
        res.status(400);
        throw new Error('Service Name, Min Price, and Max Price are required');
    }

    const newPricing = new Pricing({
        serviceName,
        description,
        minPrice,
        maxPrice,
        deliveryTime
    });

    const savedPricing = await newPricing.save();
    res.status(201).json(savedPricing);
});

// 2. READ - Sab Rates Dekhna
const getPricing = catchAsync(async (req, res) => {
    const prices = await Pricing.find().sort({ createdAt: -1 });
    res.status(200).json(prices);
});

// 3. UPDATE - Rate ya Description Change Karna
const updatePricing = catchAsync(async (req, res) => {
    const { serviceName, description, minPrice, maxPrice, deliveryTime } = req.body;
    
    const updatedPricing = await Pricing.findByIdAndUpdate(
        req.params.id,
        { serviceName, description, minPrice, maxPrice, deliveryTime },
        { new: true, runValidators: true }
    );

    if (!updatedPricing) {
        res.status(404);
        throw new Error('Pricing item not found');
    }

    res.status(200).json(updatedPricing);
});

// 4. DELETE - Rate Delete Karna
const deletePricing = catchAsync(async (req, res) => {
    const pricing = await Pricing.findByIdAndDelete(req.params.id);

    if (!pricing) {
        res.status(404);
        throw new Error('Pricing item not found');
    }

    res.status(200).json({ message: 'Pricing item deleted successfully' });
});

module.exports = { addPricing, getPricing, updatePricing, deletePricing };