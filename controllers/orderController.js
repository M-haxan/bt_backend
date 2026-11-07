const mongoose = require('mongoose');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const CustomerLedger = require('../models/CustomerLedger');
const TailoringService = require('../models/TailoringService');
const catchAsync = require('../middleware/asyncHandler');
const httpError = require('../utils/httpError');
const escapeRegex = require('../utils/escapeRegex');
const { customerFieldsFor } = require('../utils/customerFields');
const {
    WORKERS_CAN_SET_CUSTOM_PRICES,
    MAX_SUITS_PER_ORDER,
    round2,
    toMoney,
    toPercent,
    toText,
    parseJsonField,
    buildCatalogue,
    cleanSuit,
    cleanAlterations,
    calculateSubtotals,
    resolveNewAdjustment,
    applyAdjustment,
    hasProductionStarted
} = require('../utils/orderPricing');

// Cloudinary helpers import kiye
const { getImageMetadata, deleteUploadedImage } = require('../config/cloudinary');

// WHO is doing this action. Always taken from the login token, never from the request body.
const actorFrom = (user) =>
    user.role === 'admin'
        ? { userType: 'admin', name: user.name || 'Admin' }
        : { userType: 'worker', workerId: user._id, name: user.name || 'Worker' };

const parseDate = (value, label) => {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw httpError(400, `${label} is not a valid date`);
    }
    return date;
};

// Matches uploaded fabric photos to suits.
// The frontend sends "fabricImageSuitIndexes" (e.g. [1, 3]) = which suits the photos belong to.
const mapUploadedImages = (req, suitCount, positionalFallback) => {
    const map = new Map();
    const files = req.files || [];
    if (files.length === 0) return map;

    const indexes = parseJsonField(req.body.fabricImageSuitIndexes, null);
    const hasIndexes = Array.isArray(indexes) && indexes.length === files.length;

    files.forEach((file, i) => {
        const suitIndex = hasIndexes ? Number(indexes[i]) : (positionalFallback ? i : -1);
        if (Number.isInteger(suitIndex) && suitIndex >= 0 && suitIndex < suitCount) {
            const { imageUrl, imagePublicId } = getImageMetadata(file);
            map.set(suitIndex, { url: imageUrl, publicId: imagePublicId });
        }
    });
    return map;
};

// 1. CREATE - Naya Order Create Karna
const createOrder = catchAsync(async (req, res) => {
    const isAdmin = req.user.role === 'admin';
    const canCustomize = isAdmin || WORKERS_CAN_SET_CUSTOM_PRICES;

    const { customer } = req.body;
    const rawSuits = parseJsonField(req.body.suits);
    const rawAlterations = parseJsonField(req.body.alterations);
    const requestedAdjustment = parseJsonField(req.body.previousKhataAdjusted, {}) || {};

    if (!mongoose.isValidObjectId(customer)) {
        throw httpError(400, 'A valid customer is required');
    }
    if (!Array.isArray(rawSuits) || !Array.isArray(rawAlterations)) {
        throw httpError(400, 'Invalid suits or alterations data');
    }
    if (rawSuits.length === 0 && rawAlterations.length === 0) {
        throw httpError(400, 'At least one suit or alteration is required');
    }
    if (rawSuits.length > MAX_SUITS_PER_ORDER) {
        throw httpError(400, `An order can have at most ${MAX_SUITS_PER_ORDER} suits`);
    }

    const customerDoc = await Customer.findById(customer);
    if (!customerDoc) {
        throw httpError(404, 'Customer not found');
    }

    const discountPercent = toPercent(req.body.discountPercent);
    if (discountPercent > 0 && !canCustomize) {
        throw httpError(400, 'Only admin can give a discount');
    }

    // The SERVER's price list decides prices, not the browser
    const catalogue = buildCatalogue(await TailoringService.find({ isActive: { $ne: false } }).lean());
    const imageBySuit = mapUploadedImages(req, rawSuits.length, true);

    const lastOrder = await Order.findOne().sort({ orderNumber: -1 });
    const nextOrderNumber = lastOrder && lastOrder.orderNumber ? lastOrder.orderNumber + 1 : 1;

    // Only whitelisted fields are copied from the request (see cleanSuit)
    const suits = rawSuits.map((raw, index) => ({
        ...cleanSuit(raw, { customerId: customer, catalogue, canCustomize }),
        suitNumber: `BT-${nextOrderNumber}-${index + 1}`,
        ...(imageBySuit.has(index) ? { fabricImage: imageBySuit.get(index) } : {})
    }));
    const alterations = cleanAlterations(rawAlterations, customer);

    // All money fields are calculated here
    const { subtotal, discountAmount, discountedSubtotal } = calculateSubtotals({ suits, alterations, discountPercent });
    if (subtotal <= 0) {
        throw httpError(400, 'Order total cannot be zero');
    }

    const previousKhataAdjusted = resolveNewAdjustment(requestedAdjustment.type, customerDoc.khataBalance, discountedSubtotal);
    const totalAmount = applyAdjustment(discountedSubtotal, previousKhataAdjusted);

    const advancePaid = toMoney(req.body.advancePaid, 'Advance');
    if (advancePaid > totalAmount) {
        throw httpError(400, 'Advance cannot be more than the total amount');
    }

    const newOrder = new Order({
        orderNumber: nextOrderNumber,
        customer,
        suits,
        alterations,
        subtotal,
        discountPercent,
        discountAmount,
        totalAmount,
        advancePaid,
        balanceAmount: round2(totalAmount - advancePaid),
        deliveryDate: parseDate(req.body.deliveryDate, 'Delivery date'),
        bookingDate: parseDate(req.body.bookingDate, 'Booking date') || Date.now(),
        previousKhataAdjusted,
        createdBy: actorFrom(req.user) // from the login token, not from the request body
    });

    const savedOrder = await newOrder.save();

    // 🌟 If Previous Khata was adjusted on this order, record in Customer Ledger 🌟
    if (previousKhataAdjusted.amount > 0) {
        const adjAmount = previousKhataAdjusted.amount;
        const currentBal = Number(customerDoc.khataBalance) || 0;
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

    res.status(201).json(savedOrder);
});

// 2. READ - Sab Orders Dekhna (Supports DB Pagination, Search, and Status Filter)
const getAllOrders = catchAsync(async (req, res) => {
    const { page, limit, search, status } = req.query;
    const customerFields = customerFieldsFor(req.user);

    let filter = {};

    // 1. Status Filter
    if (status && status !== 'All') {
        if (status === 'PendingQC') {
            filter['suits.stitchingStatus'] = 'Submitted for Inspection';
        } else if (status === 'Active') {
            filter.orderStatus = { $nin: ['Delivered', 'Cancelled'] };
        } else {
            filter.orderStatus = status;
        }
    }

    // 2. Search Filter (Customer Name/Phone, Order #, Suit #, Wearer, Fabric, Vol, Design)
    if (search && search.trim()) {
        const rawSearch = search.trim();
        const searchClean = rawSearch.replace(/^#/, '').replace(/^bt[-\s]?/i, '').trim();
        const regex = new RegExp(rawSearch, 'i');
        const cleanRegex = new RegExp(searchClean, 'i');

        const customerOr = [{ name: regex }, { phone: cleanRegex }];
        const digits = rawSearch.replace(/\D/g, '');
        if (digits) {
            const num = Number(digits.replace(/^0+/, ''));
            if (!isNaN(num) && num > 0) {
                customerOr.push({ phone: num });
            }
        }

        const matchingCustomers = await Customer.find({
            $or: customerOr
        }).select('_id');
        const customerIds = matchingCustomers.map(c => c._id);

        const searchOr = [
            { customer: { $in: customerIds } },
            { 'suits.suitNumber': cleanRegex },
            { 'suits.fabricDetails': regex },
            { 'suits.volumeNo': regex },
            { 'suits.customDesign': regex },
            { 'suits.staticTags': regex }
        ];

        if (!isNaN(searchClean) && searchClean !== '') {
            searchOr.push({ orderNumber: Number(searchClean) });
        }

        if (filter.$and) {
            filter.$and.push({ $or: searchOr });
        } else {
            filter.$or = searchOr;
        }
    }

    // Counts across all categories for tab badges
    const [totalPendingQCOrders, totalActiveOrders, totalDeliveredOrders, totalAllOrders] = await Promise.all([
        Order.countDocuments({ 'suits.stitchingStatus': 'Submitted for Inspection' }),
        Order.countDocuments({ orderStatus: { $nin: ['Delivered', 'Cancelled'] } }),
        Order.countDocuments({ orderStatus: 'Delivered' }),
        Order.countDocuments({})
    ]);

    // High-performance DB-level Financial Aggregations for Payments Ledger
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const [
        todayAdvanceResult, 
        todayDeliveryResult,
        receivablesResult,
        partialResult,
        fullyPaidCount,
        unpaidCount
    ] = await Promise.all([
        // 1. Advance Cash collected at counter today
        Order.aggregate([
            { $match: { createdAt: { $gte: startOfToday, $lte: endOfToday }, advancePaid: { $gt: 0 } } },
            { $group: { _id: null, total: { $sum: '$advancePaid' } } }
        ]),
        // 2. Delivery Cash collected at counter today
        Order.aggregate([
            { $match: { 'receivedAtDelivery.date': { $gte: startOfToday, $lte: endOfToday }, 'receivedAtDelivery.amount': { $gt: 0 } } },
            { $group: { _id: null, total: { $sum: '$receivedAtDelivery.amount' } } }
        ]),
        // 3. Total Outstanding Receivables in shop
        Order.aggregate([
            { $match: { balanceAmount: { $gt: 0 } } },
            { $group: { _id: null, total: { $sum: '$balanceAmount' } } }
        ]),
        // 4. Partially paid orders
        Order.aggregate([
            { $match: { balanceAmount: { $gt: 0 }, advancePaid: { $gt: 0 } } },
            { $group: { _id: null, count: { $sum: 1 }, balance: { $sum: '$balanceAmount' } } }
        ]),
        // 5. Fully paid orders
        Order.countDocuments({ balanceAmount: 0 }),
        // 6. Completely unpaid orders
        Order.countDocuments({ advancePaid: 0, balanceAmount: { $gt: 0 } })
    ]);

    const todayAdvance = todayAdvanceResult[0]?.total || 0;
    const todayDeliveryCash = todayDeliveryResult[0]?.total || 0;
    const todayCashCollected = todayAdvance + todayDeliveryCash;
    const totalOutstandingBalance = receivablesResult[0]?.total || 0;
    const partialPaidCount = partialResult[0]?.count || 0;
    const partialPaidBalance = partialResult[0]?.balance || 0;

    const financialStats = {
        todayCashCollected,
        todayAdvance,
        todayDeliveryCash,
        totalOutstandingBalance,
        partialPaidCount,
        partialPaidBalance,
        fullyPaidCount: fullyPaidCount || 0,
        unpaidCount: unpaidCount || 0
    };

    // If page or limit is provided, perform database-level server-side pagination
    if (page || limit) {
        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.max(1, parseInt(limit, 10) || 10);
        const skip = (currentPage - 1) * pageSize;

        const totalRecords = await Order.countDocuments(filter);
        const totalPages = Math.ceil(totalRecords / pageSize) || 1;

        const orders = await Order.find(filter)
                       .populate('customer', customerFields)
            .populate('suits.wearer', customerFields)
            .populate('alterations.wearer', customerFields)
            .sort({ bookingDate: -1, createdAt: -1 })
            .skip(skip)
            .limit(pageSize);

        return res.status(200).json({
            data: orders,
            pagination: {
                totalRecords,
                currentPage,
                totalPages,
                pageSize
            },
            totalPendingQC: totalPendingQCOrders,
            counts: {
                all: totalAllOrders,
                active: totalActiveOrders,
                delivered: totalDeliveredOrders,
                pendingQC: totalPendingQCOrders
            },
            financialStats
        });
    }

    // Otherwise, return full array
    const orders = await Order.find(filter)
        .populate('customer')
        .populate('suits.wearer')
        .populate('alterations.wearer')
        .sort({ bookingDate: -1, createdAt: -1 });
    res.status(200).json(orders);
});

// 3. READ - Customer Specific Orders
const getCustomerOrders = catchAsync(async (req, res) => {
    const customerFields = customerFieldsFor(req.user);

    const orders = await Order.find({ customer: req.params.customerId })
        .populate('customer', customerFields)
        .populate('suits.wearer', customerFields)
        .populate('alterations.wearer', customerFields)
        .sort({ bookingDate: -1 });
    res.status(200).json(orders);
});
// 3.1 READ - Single Order Details By ID (For Order Edit / Full View)
const getOrderById = catchAsync(async (req, res) => {
    const customerFields = customerFieldsFor(req.user);

    const order = await Order.findById(req.params.id)
        .populate('customer', customerFields)
        .populate('suits.wearer', customerFields)
        .populate('alterations.wearer', customerFields)
        .populate('createdBy', 'name userType');

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }
    res.status(200).json(order);
});
// 4. UPDATE - Order Status ya Details Change Karna
const updateOrder = catchAsync(async (req, res) => {
    const isAdmin = req.user.role === 'admin';
    const canCustomize = isAdmin || WORKERS_CAN_SET_CUSTOM_PRICES;

    const order = await Order.findById(req.params.id);
    if (!order) {
        throw httpError(404, 'Order not found');
    }

    // Delivered / cancelled orders are locked: editing them would silently change the books
    if (['Delivered', 'Cancelled'].includes(order.orderStatus)) {
        throw httpError(400, `${order.orderStatus} orders are locked and cannot be edited`);
    }
    if (req.body.customer && String(req.body.customer) !== String(order.customer)) {
        throw httpError(400, 'The customer of an existing order cannot be changed');
    }

    const catalogue = buildCatalogue(await TailoringService.find({ isActive: { $ne: false } }).lean());
    const replacedImageIds = [];

    // ---- Suits: MERGE into the existing ones (never replace the whole array) ----
    if (req.body.suits !== undefined) {
        const rawSuits = parseJsonField(req.body.suits);
        if (!Array.isArray(rawSuits)) {
            throw httpError(400, 'Invalid suits data');
        }
        if (rawSuits.length > MAX_SUITS_PER_ORDER) {
            throw httpError(400, `An order can have at most ${MAX_SUITS_PER_ORDER} suits`);
        }

        const idsInRequest = new Set(rawSuits.filter((r) => r && r._id).map((r) => String(r._id)));

        // Suits that are not in the request get removed, but ONLY if no work has started on them
        const toRemove = order.suits.filter((s) => !idsInRequest.has(String(s._id)));
        toRemove.forEach((s) => {
            if (hasProductionStarted(s)) {
                throw httpError(400, `Suit ${s.suitNumber} is already in production and cannot be removed. Please refresh the page and try again.`);
            }
        });

        // Next free suit number (never re-use the number of a removed suit)
        let nextSuffix = order.suits.reduce((max, s) => {
            const n = parseInt(String(s.suitNumber || '').split('-').pop(), 10) || 0;
            return Math.max(max, n);
        }, 0) + 1;

        toRemove.forEach((s) => order.suits.pull(s._id));

        const imageBySuit = mapUploadedImages(req, rawSuits.length, false);

        rawSuits.forEach((raw, index) => {
            const existing = raw && raw._id && mongoose.isValidObjectId(raw._id) ? order.suits.id(raw._id) : null;
            const cleaned = cleanSuit(raw, { customerId: order.customer, catalogue, canCustomize, existing });
            const newImage = imageBySuit.get(index);

            if (existing) {
                // set() touches ONLY the fields in `cleaned`.
                // Cutting / stitching / finishing, wages, QC status and workers stay untouched.
                existing.set(cleaned);
                if (newImage) {
                    if (existing.fabricImage && existing.fabricImage.publicId) {
                        replacedImageIds.push(existing.fabricImage.publicId);
                    }
                    existing.fabricImage = newImage;
                }
            } else {
                order.suits.push({
                    ...cleaned,
                    suitNumber: `BT-${order.orderNumber}-${nextSuffix++}`,
                    ...(newImage ? { fabricImage: newImage } : {})
                });
            }
        });
    }

    if (req.body.alterations !== undefined) {
        order.alterations = cleanAlterations(parseJsonField(req.body.alterations), order.customer);
    }

    // ---- Money: always recalculated on the server ----
    let discountPercent = Number(order.discountPercent) || 0;
    if (canCustomize && req.body.discountPercent !== undefined) {
        discountPercent = toPercent(req.body.discountPercent);
    }

    const { subtotal, discountAmount, discountedSubtotal } = calculateSubtotals({
        suits: order.suits,
        alterations: order.alterations,
        discountPercent
    });
    if (subtotal <= 0) {
        throw httpError(400, 'Order total cannot be zero');
    }

    // The khata adjustment chosen when the order was booked stays fixed
    const stored = order.previousKhataAdjusted || {};
    const adjustment = { type: stored.type || 'none', amount: Number(stored.amount) || 0 };
    const totalAmount = applyAdjustment(discountedSubtotal, adjustment);

    const advancePaid = req.body.advancePaid !== undefined
        ? toMoney(req.body.advancePaid, 'Advance')
        : (Number(order.advancePaid) || 0);
    if (advancePaid > totalAmount) {
        throw httpError(400, 'Advance cannot be more than the total amount');
    }

    order.subtotal = subtotal;
    order.discountPercent = discountPercent;
    order.discountAmount = discountAmount;
    order.totalAmount = totalAmount;
    order.advancePaid = advancePaid;
    order.balanceAmount = round2(totalAmount - advancePaid);

    const deliveryDate = parseDate(req.body.deliveryDate, 'Delivery date');
    if (deliveryDate) order.deliveryDate = deliveryDate;
    const bookingDate = parseDate(req.body.bookingDate, 'Booking date');
    if (bookingDate) order.bookingDate = bookingDate;

    // ---- Status: only admin, and never "Delivered" (that goes through the delivery screen) ----
    const { orderStatus } = req.body;
    if (orderStatus && orderStatus !== order.orderStatus) {
        if (!isAdmin) {
            throw httpError(403, 'Only admin can change the order status');
        }
        if (!['Pending', 'In Progress', 'Completed', 'Cancelled'].includes(orderStatus)) {
            throw httpError(400, 'Invalid order status. "Delivered" can only be set from the delivery screen.');
        }
        order.orderStatus = orderStatus;
    }

    await order.save();

    // Remove replaced photos from Cloudinary (best effort: a failure here must not break the save)
    for (const publicId of replacedImageIds) {
        try {
            await deleteUploadedImage(publicId);
        } catch (error) {
            console.error('Old image cleanup failed:', error.message);
        }
    }

    await order.populate({ path: 'customer', select: customerFieldsFor(req.user) });
    res.status(200).json(order);
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
    const phoneDigits = String(req.query.phone || '').replace(/\D/g, '');

    if (phoneDigits.length < 4) {
        throw httpError(400, 'Please enter the last 4 digits of the phone number used for this order');
    }

    // ONE message for "no such order" and "wrong digits": never tell a stranger which one failed
    const notFound = () => httpError(404, 'No order found. Please check the order number and the last 4 digits of your phone number.');

    let num = String(orderNumber).trim();
    if (num.toUpperCase().startsWith('BT-')) {
        num = num.slice(3);
    }
    const parsedNum = Number(num);
    if (!Number.isInteger(parsedNum) || parsedNum <= 0) {
        throw notFound();
    }

    const order = await Order.findOne({ orderNumber: parsedNum })
        .populate('customer', 'name phone')
        .populate('suits.wearer', 'name');

    const customerDigits = String(order?.customer?.phone || '').replace(/\D/g, '');
    if (!order || !customerDigits || customerDigits.slice(-4) !== phoneDigits.slice(-4)) {
        throw notFound();
    }

    // Only customer-safe information: no wages, no worker names, no phone numbers, no measurements
    res.status(200).json({
        orderNumber: order.orderNumber,
        bookingDate: order.bookingDate,
        deliveryDate: order.deliveryDate,
        orderStatus: order.orderStatus,
        customerName: order.customer?.name || 'Customer',
        suits: order.suits.map((s) => ({
            _id: s._id,
            fabricDetails: s.fabricDetails,
            wearerName: s.wearer?.name || order.customer?.name || 'Wearer',
            stitchingStatus: s.stitchingStatus,
            volumeNo: s.volumeNo
        }))
    });
});

// 4.1 UPDATE ORDER STATUS ONLY (admin). Does not touch prices, suits or payments.
// "Delivered" is never set here: it goes through the delivery screen (payment settlement).
const ORDER_STATUS_FLOW = {
    'Pending': ['In Progress', 'Completed', 'Cancelled'],
    'In Progress': ['Pending', 'Completed', 'Cancelled'],
    'Completed': ['In Progress', 'Cancelled'],
    'Delivered': [],
    'Cancelled': []
};
// Set to false if you want to allow "Completed" even when some suits are not stitched yet
const REQUIRE_ALL_SUITS_STITCHED_FOR_COMPLETED = true;

const updateOrderStatus = catchAsync(async (req, res) => {
    const { orderStatus } = req.body;

    if (!orderStatus || !Object.keys(ORDER_STATUS_FLOW).includes(orderStatus)) {
        throw httpError(400, 'Invalid order status');
    }
    if (orderStatus === 'Delivered') {
        throw httpError(400, '"Delivered" can only be set from the delivery screen.');
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
        throw httpError(404, 'Order not found');
    }

    if (order.orderStatus === orderStatus) {
        return res.status(200).json(order);
    }

    if (!ORDER_STATUS_FLOW[order.orderStatus].includes(orderStatus)) {
        throw httpError(400, `${order.orderStatus} orders cannot be changed to "${orderStatus}".`);
    }

    if (orderStatus === 'Completed' && REQUIRE_ALL_SUITS_STITCHED_FOR_COMPLETED) {
        const pending = order.suits.filter((s) => s.stitchingStatus !== 'Stitched').length;
        if (pending > 0) {
            throw httpError(400, `${pending} suit(s) are not stitched yet. Stitch / approve all suits before marking the order Completed.`);
        }
    }

    order.orderStatus = orderStatus;
    await order.save();

    const updated = await Order.findById(order._id)
        .populate('customer', customerFieldsFor(req.user))
        .populate('suits.wearer', customerFieldsFor(req.user))
        .populate('alterations.wearer', customerFieldsFor(req.user));

    res.status(200).json(updated);
});

// 8. DELIVER ORDER & SETTLE PAYMENT / RECORD UDHAR OR OVERPAYMENT
const deliverOrder = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { paymentMethod = 'Cash' } = req.body;

    const order = await Order.findById(id).populate('customer', 'name phone whatsapp address city');
    if (!order) {
        throw httpError(404, 'Order not found');
    }

    // An order can be delivered only ONCE (a double click must not post the ledger twice)
    if (order.orderStatus === 'Delivered') {
        throw httpError(400, 'This order has already been delivered');
    }
    if (order.orderStatus === 'Cancelled') {
        throw httpError(400, 'A cancelled order cannot be delivered');
    }

    // WHO delivered: from the login token, not from the request body
    const parsedDeliveredBy = actorFrom(req.user);

    const numReceived = toMoney(req.body.receivedAmount, 'Received amount');
    const previousBalance = Number(order.balanceAmount) || 0;
    const diff = previousBalance - numReceived; // Positive = Underpaid (Udhar), Negative = Overpaid (Credit)

    // Update order status and delivery details
    order.orderStatus = 'Delivered';
    order.receivedAtDelivery = {
        amount: numReceived,
        date: new Date(),
        paymentMethod: toText(paymentMethod, 30) || 'Cash'
    };
    order.deliveredBy = parsedDeliveredBy;
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
    getOrderById,
    getCustomerOrders,
    updateOrder,
    deleteOrder,
    trackOrderPublic,
    updateOrderStatus,
    deliverOrder
};