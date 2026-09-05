const Order = require('../models/Order');
const Customer = require('../models/Customer');
const CustomerLedger = require('../models/CustomerLedger');
const catchAsync = require('../middleware/asyncHandler');

// Cloudinary helpers import kiye
const { getImageMetadata, deleteUploadedImage } = require('../config/cloudinary');

// 1. CREATE - Naya Order Create Karna
const createOrder = catchAsync(async (req, res) => {
    let { 
        customer, 
        suits, 
        alterations, 
        totalAmount, 
        advancePaid, 
        balanceAmount, 
        deliveryDate,
        previousKhataAdjusted 
    } = req.body;

    // IMPORTANT LOGIC: Jab frontend se FormData (images) aata hai, toh arrays JSON string ban jati hain.
    // Isliye humein inko pehle wapis normal array mein parse (convert) karna hoga.
    if (typeof suits === 'string') suits = JSON.parse(suits);
    if (typeof alterations === 'string') alterations = JSON.parse(alterations);
    if (typeof previousKhataAdjusted === 'string') {
        try {
            previousKhataAdjusted = JSON.parse(previousKhataAdjusted);
        } catch (e) {
            console.error('Error parsing previousKhataAdjusted:', e);
        }
    }

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
        advancePaid: advancePaid || 0,
        balanceAmount: balanceAmount || 0,
        deliveryDate,
        previousKhataAdjusted: previousKhataAdjusted || { type: 'none', amount: 0 }
    });
    
    const savedOrder = await newOrder.save();

    // 🌟 If Previous Khata was adjusted on this order, record in Customer Ledger 🌟
    if (previousKhataAdjusted && previousKhataAdjusted.amount > 0) {
        const customerDoc = await Customer.findById(customer);
        if (customerDoc) {
            const adjAmount = Number(previousKhataAdjusted.amount);
            let currentBal = Number(customerDoc.khataBalance) || 0;
            let newBal = currentBal;

            if (previousKhataAdjusted.type === 'deducted_advance') {
                // Customer's stored advance (-ve) was consumed in this order
                newBal = currentBal + adjAmount;
                await CustomerLedger.create({
                    customer,
                    type: 'adjustment',
                    amount: adjAmount,
                    runningBalance: newBal,
                    description: `Advance balance adjusted into new Order #BT-${nextOrderNumber}`,
                    orderId: savedOrder._id,
                    orderNumber: nextOrderNumber
                });
            } else if (previousKhataAdjusted.type === 'added_due') {
                // Previous udhar (+ve) added into invoice
                await CustomerLedger.create({
                    customer,
                    type: 'adjustment',
                    amount: adjAmount,
                    runningBalance: currentBal,
                    description: `Previous due included in Order #BT-${nextOrderNumber} invoice`,
                    orderId: savedOrder._id,
                    orderNumber: nextOrderNumber
                });
            }

            customerDoc.khataBalance = newBal;
            await customerDoc.save();
        }
    }

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

// 8. DELIVER ORDER & SETTLE PAYMENT / RECORD UDHAR OR OVERPAYMENT
const deliverOrder = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { receivedAmount = 0, paymentMethod = 'Cash' } = req.body;

    const order = await Order.findById(id).populate('customer');
    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    const numReceived = Number(receivedAmount) || 0;
    const previousBalance = Number(order.balanceAmount) || 0;
    const diff = previousBalance - numReceived; // Positive = Underpaid (Udhar), Negative = Overpaid (Credit)

    // Update order status and delivery details
    order.orderStatus = 'Delivered';
    order.receivedAtDelivery = {
        amount: numReceived,
        date: new Date(),
        paymentMethod: paymentMethod || 'Cash'
    };
    order.balanceAmount = Math.max(0, previousBalance - numReceived);

    // If there is a customer attached, update their khata
    const customer = await Customer.findById(order.customer?._id || order.customer);
    let updatedKhataBalance = customer ? Number(customer.khataBalance) || 0 : 0;

    if (customer) {
        if (diff > 0) {
            // Customer paid less than due -> Remaining amount is recorded as Udhar (debit)
            updatedKhataBalance += diff;
            await CustomerLedger.create({
                customer: customer._id,
                type: 'debit',
                amount: diff,
                runningBalance: updatedKhataBalance,
                description: `Unpaid balance (Udhar) on delivery of Order #BT-${order.orderNumber}`,
                orderId: order._id,
                orderNumber: order.orderNumber
            });
        } else if (diff < 0) {
            // Customer paid more than due -> Excess amount is recorded as Advance Credit
            const excess = Math.abs(diff);
            updatedKhataBalance -= excess;
            await CustomerLedger.create({
                customer: customer._id,
                type: 'credit',
                amount: excess,
                runningBalance: updatedKhataBalance,
                description: `Overpayment / Change retained on delivery of Order #BT-${order.orderNumber}`,
                orderId: order._id,
                orderNumber: order.orderNumber
            });
        } else if (numReceived > 0 && previousBalance > 0) {
            // Exact payment received
            await CustomerLedger.create({
                customer: customer._id,
                type: 'payment',
                amount: numReceived,
                runningBalance: updatedKhataBalance,
                description: `Full payment settled on delivery of Order #BT-${order.orderNumber}`,
                orderId: order._id,
                orderNumber: order.orderNumber
            });
        }

        customer.khataBalance = updatedKhataBalance;
        await customer.save();
    }

    const savedOrder = await order.save();

    res.status(200).json({
        message: 'Order marked as Delivered and payment/Khata settled successfully',
        order: savedOrder,
        khataBalance: updatedKhataBalance
    });
});

module.exports = {
    createOrder,
    getAllOrders,
    getCustomerOrders,
    updateOrder,
    deleteOrder,
    trackOrderPublic,
    trackSuitPublic,
    deliverOrder
};