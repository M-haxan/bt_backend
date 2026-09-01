const Order = require('../models/Order');
const catchAsync = require('../middleware/asyncHandler');

// Cloudinary helpers import kiye
const { getImageMetadata, deleteUploadedImage } = require('../config/cloudinary');

// 1. CREATE - Naya Order Create Karna
const createOrder = catchAsync(async (req, res) => {
    let { customer, suits, alterations, totalAmount, advancePaid, balanceAmount, deliveryDate } = req.body;

    // IMPORTANT LOGIC: Jab frontend se FormData (images) aata hai, toh arrays JSON string ban jati hain.
    // Isliye humein inko pehle wapis normal array mein parse (convert) karna hoga.
    if (typeof suits === 'string') suits = JSON.parse(suits);
    if (typeof alterations === 'string') alterations = JSON.parse(alterations);

    // Validation Update: "Ya suits hon, YA alterations hon" (Dono mein se ek lazmi hai)
    if (!customer || (!suits?.length && !alterations?.length) || totalAmount === undefined) {
        res.status(400);
        throw new Error('Customer, at least one suit OR alteration, and total amount are required');
    }

    // 🌟 Fabric Images Mapping Logic 🌟
    // Agar suits hain aur request mein images (files) bhi aayi hain
    if (suits && suits.length > 0 && req.files && req.files.length > 0) {
        // Hum loop chala rahe hain aur har image ko uske number wale suit mein daal rahe hain
        suits = suits.map((suit, index) => {
            if (req.files[index]) {
                const { imageUrl, imagePublicId } = getImageMetadata(req.files[index]);
                return { ...suit, fabricImage: { url: imageUrl, publicId: imagePublicId } };
            }
            return suit;
        });
    }

    const lastOrder = await Order.findOne().sort({ orderNumber: -1 });
    let nextOrderNumber = 1; 
    if (lastOrder && lastOrder.orderNumber) {
        nextOrderNumber = lastOrder.orderNumber + 1; 
    }

    const newOrder = new Order({
        orderNumber: nextOrderNumber,
        customer,
        suits: suits || [],
        alterations: alterations || [],
        totalAmount,
        advancePaid,
        balanceAmount,
        deliveryDate
    });
    
    const savedOrder = await newOrder.save();
    res.status(201).json(savedOrder);
});

// 2. READ - Sab Orders Dekhna
const getAllOrders = catchAsync(async (req, res) => {
    const orders = await Order.find()
        .populate('customer')
        .populate('suits.wearer')
        .populate('alterations.wearer')
        .sort({ bookingDate: -1 });
    res.status(200).json(orders);
});

// 3. READ - Customer Specific Orders
const getCustomerOrders = catchAsync(async (req, res) => {
    const orders = await Order.find({ customer: req.params.customerId })
        .populate('customer')
        .populate('suits.wearer')
        .populate('alterations.wearer')
        .sort({ bookingDate: -1 });
    res.status(200).json(orders);
});

// 4. UPDATE - Order Status ya Details Change Karna
const updateOrder = catchAsync(async (req, res) => {
    const { suits, alterations, totalAmount, advancePaid, balanceAmount, deliveryDate, orderStatus } = req.body;

    const updatedOrder = await Order.findByIdAndUpdate(
        req.params.id,
        { suits, alterations, totalAmount, advancePaid, balanceAmount, deliveryDate, orderStatus },
        { new: true, runValidators: true }
    ).populate('customer'); 
    
    if (!updatedOrder) {
        res.status(404);
        throw new Error('Order not found');
    }
    
    res.status(200).json(updatedOrder);
});

// 5. DELETE - Order Delete Karna (With Cloudinary Cleanup)
const deleteOrder = catchAsync(async (req, res) => {
    // findByIdAndDelete ki jagah findById kiya hai taake images ka data mil sake
    const order = await Order.findById(req.params.id); 
    
    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    // 🧹 Order delete karne se pehle uski saari fabric images Cloudinary se delete karo
    if (order.suits && order.suits.length > 0) {
        for (let suit of order.suits) {
            if (suit.fabricImage && suit.fabricImage.publicId) {
                await deleteUploadedImage(suit.fabricImage.publicId);
            }
        }
    }
    
    await order.deleteOne(); // Ab DB se delete kar do
    res.status(200).json({ message: 'Order and associated fabric images deleted successfully' }); 
});

// 6. PUBLIC TRACK ORDER
const trackOrderPublic = catchAsync(async (req, res) => {
    const { orderNumber } = req.params;
    let num = orderNumber;
    if (orderNumber.startsWith('BT-')) {
        num = orderNumber.replace('BT-', '');
    }
    const parsedNum = Number(num);
    if (isNaN(parsedNum)) {
        res.status(400);
        throw new Error('Invalid order number format');
    }

    const order = await Order.findOne({ orderNumber: parsedNum })
        .populate('customer', 'name phone')
        .populate('suits.wearer', 'name phone')
        .populate('alterations.wearer', 'name phone');

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    res.status(200).json({
        orderNumber: order.orderNumber,
        bookingDate: order.bookingDate,
        deliveryDate: order.deliveryDate,
        orderStatus: order.orderStatus,
        customerName: order.customer?.name || 'Customer',
        suits: order.suits.map(s => ({
            _id: s._id,
            fabricDetails: s.fabricDetails,
            wearerName: s.wearer?.name || order.customer?.name || 'Wearer',
            stitchingStatus: s.stitchingStatus,
            volumeNo: s.volumeNo,
            staticTags: s.staticTags,
            cutting: s.cutting,
            stitching: s.stitching,
            finishing: s.finishing
        })),
        alterations: order.alterations.map(a => ({
            alterationDetails: a.alterationDetails,
            wearerName: a.wearer?.name || order.customer?.name || 'Wearer',
            status: a.status
        }))
    });
});

// 7. PUBLIC TRACK SUIT
const trackSuitPublic = catchAsync(async (req, res) => {
    const { suitId } = req.params;

    const order = await Order.findOne({ 'suits._id': suitId })
        .populate('customer')
        .populate('suits.wearer');

    if (!order) {
        res.status(404);
        throw new Error('Suit not found or order deleted');
    }

    const suit = order.suits.id(suitId);
    if (!suit) {
        res.status(404);
        throw new Error('Suit details not found');
    }

    const wearer = suit.wearer || order.customer;
    const hasMeasurements = wearer?.measurements && wearer.measurements.length > 0;
    const measurementsData = hasMeasurements ? wearer.measurements[0].data : {};
    const measurementsCategory = hasMeasurements ? wearer.measurements[0].category : '';
    const measurementsPreferences = hasMeasurements ? wearer.measurements[0].preferences : [];

    res.status(200).json({
        suitId: suit._id,
        orderNumber: order.orderNumber,
        bookingDate: order.bookingDate,
        deliveryDate: order.deliveryDate,
        stitchingStatus: suit.stitchingStatus,
        fabricDetails: suit.fabricDetails,
        volumeNo: suit.volumeNo,
        staticTags: suit.staticTags || [],
        customDesign: suit.customDesign || '',
        designImage: suit.designImage,
        fabricImage: suit.fabricImage,
        cutting: suit.cutting,
        stitching: suit.stitching,
        finishing: suit.finishing,
        wearer: {
            name: wearer.name,
            phone: wearer.phone,
            measurements: {
                category: measurementsCategory,
                data: measurementsData,
                preferences: measurementsPreferences
            }
        }
    });
});

module.exports = {
    createOrder,
    getAllOrders,
    getCustomerOrders,
    updateOrder,
    deleteOrder,
    trackOrderPublic,
    trackSuitPublic
};