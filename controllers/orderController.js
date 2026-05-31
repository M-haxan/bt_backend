// import models
const Order = require('../models/Order');
const catchAsync = require('../middleware/asyncHandler');

// 1. CREATE - Naya Order Create Karna
const createOrder = catchAsync(async (req, res) => {
    const { customer, suits, totalAmount, advancePaid, balanceAmount, deliveryDate } = req.body;
    
    if (!customer || !suits || suits.length === 0 || totalAmount === undefined) {
        res.status(400);
        throw new Error('Customer, at least one suit, and total amount are required');
    }
    const lastOrder = await Order.findOne().sort({ orderNumber: -1 });
    let nextOrderNumber = 1; // Agar database khali hai toh 1 se shuru hoga
    if (lastOrder && lastOrder.orderNumber) {
        nextOrderNumber = lastOrder.orderNumber + 1; // Warna purane mein 1 add kar do
    }
    const newOrder = new Order({
         orderNumber: nextOrderNumber,
        customer,
        suits,
        totalAmount,
        advancePaid,
        balanceAmount,
        deliveryDate
    });
    
    const savedOrder = await newOrder.save();
    res.status(201).json(savedOrder); // <-- Changed: Direct object return to match your frontend
});

// 2. READ - Sab Orders Dekhna
const getAllOrders = catchAsync(async (req, res) => {
    const orders = await Order.find().populate('customer').sort({ bookingDate: -1 });
    res.status(200).json(orders); // <-- Changed
});

// 3. READ - Customer Specific Orders
const getCustomerOrders = catchAsync(async (req, res) => {
    // req.params.customerId route se aayega
    const orders = await Order.find({ customer: req.params.customerId }).populate('customer').sort({ bookingDate: -1 });
    res.status(200).json(orders); // <-- Changed
});

// 4. UPDATE - Order Status ya Details Change Karna
const updateOrder = catchAsync(async (req, res) => {
    const { suits, totalAmount, advancePaid, balanceAmount, deliveryDate, orderStatus } = req.body;
    
    const updatedOrder = await Order.findByIdAndUpdate(
        req.params.id,
        { suits, totalAmount, advancePaid, balanceAmount, deliveryDate, orderStatus },
        { new: true, runValidators: true }
    ).populate('customer'); 
    
    if (!updatedOrder) {
        res.status(404);
        throw new Error('Order not found');
    }
    
    res.status(200).json(updatedOrder); // <-- Changed
});

// 5. DELETE - Order Delete Karna
const deleteOrder = catchAsync(async (req, res) => {
    const order = await Order.findByIdAndDelete(req.params.id); 
    
    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }
    
    // Delete ke time par status message bhej diya
    res.status(200).json({ message: 'Order deleted successfully' }); 
});

// EXPORTS (Yeh sab se zaroori tha!)
module.exports = {
    createOrder,
    getAllOrders,
    getCustomerOrders,
    updateOrder,
    deleteOrder
};