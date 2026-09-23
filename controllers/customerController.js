const Customer = require('../models/Customer');
const Order = require('../models/Order');
const CustomerLedger = require('../models/CustomerLedger');
const asyncHandler = require('../middleware/asyncHandler');
const { getImageMetadata, deleteUploadedImage } = require('../config/cloudinary'); 
const jwt = require('jsonwebtoken');

// Token generate karne ka function
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// Helper: Ensure customerNumber exists
const getNextCustomerNumber = async () => {
    const lastCustomer = await Customer.findOne({ customerNumber: { $exists: true, $ne: null } })
        .sort({ customerNumber: -1 });
    if (lastCustomer && lastCustomer.customerNumber) {
        return lastCustomer.customerNumber + 1;
    }
    return 1001;
};

// 1. CREATING CUSTOMER (With Profile Photo, Customer ID & WhatsApp)
const createCustomer = asyncHandler(async (req, res) => {
    let { name, phone, whatsapp, address, city, measurements, pin, cnic, stitchingPreferences } = req.body;

    if (typeof measurements === 'string') {
        try {
            measurements = JSON.parse(measurements);
        } catch (e) {
            console.error('Error parsing measurements:', e);
        }
    }

    if (typeof stitchingPreferences === 'string') {
        try {
            stitchingPreferences = JSON.parse(stitchingPreferences);
        } catch (e) {
            console.error('Error parsing stitchingPreferences:', e);
        }
    }

    // Check if customer already exists
    const customerExists = await Customer.findOne({ phone });
    if (customerExists) {
        res.status(400);
        throw new Error('Customer with this phone number already exists');
    }

    // Profile Image handling
    let profileImage = { url: null, public_id: null };
    if (req.file) {
        const { imageUrl, imagePublicId } = getImageMetadata(req.file);
        profileImage = { url: imageUrl, public_id: imagePublicId };
    }

    // Auto-generate customerNumber
    const customerNumber = await getNextCustomerNumber();

    // Prepare measurements with Version 1 history
    let formattedMeasurements = [];
    if (Array.isArray(measurements) && measurements.length > 0) {
        formattedMeasurements = measurements.map(m => ({
            category: m.category,
            data: m.data || {},
            preferences: m.preferences || [],
            lastUpdated: new Date(),
            history: [{
                version: 1,
                data: m.data || {},
                preferences: m.preferences || [],
                notes: 'Initial measurement recorded at registration',
                recordedAt: new Date()
            }]
        }));
    }

    // Add new customer
    const customer = await Customer.create({ 
        customerNumber,
        name, 
        phone, 
        whatsapp: whatsapp || '',
        address: address || '',
        city: city || '',
        measurements: formattedMeasurements, 
        stitchingPreferences: stitchingPreferences || {},
        pin, 
        profileImage,
        cnic
    });

    res.status(201).json(customer);
});

// 2. CUSTOMER LOGIN (Portal Ke Liye)
const loginCustomer = asyncHandler(async (req, res) => {
    const { phone, pin } = req.body;

    const customer = await Customer.findOne({ phone });

    if (customer && (await customer.matchPin(pin))) {
        res.json({
            _id: customer._id,
            customerNumber: customer.customerNumber,
            name: customer.name,
            phone: customer.phone,
            profileImage: customer.profileImage,
            token: generateToken(customer._id)
        });
    } else {
        res.status(401);
        throw new Error('Invalid phone number or PIN');
    }
});

// 3. GETTING ALL CUSTOMERS (Supports DB Pagination & Search)
const getCustomers = asyncHandler(async (req, res) => {
    const { page, limit, search } = req.query;

    let query = {};
    if (search && search.trim()) {
        const cleanSearch = search.trim();
        const searchRegex = new RegExp(cleanSearch, 'i');
        const numSearch = Number(cleanSearch);

        query.$or = [
            { name: searchRegex },
            { phone: searchRegex },
            { city: searchRegex },
            { address: searchRegex },
            { cnic: searchRegex }
        ];

        if (!isNaN(numSearch) && numSearch > 0) {
            query.$or.push({ customerNumber: numSearch });
        }
    }

    // If page or limit is provided, perform database-level server-side pagination
    if (page || limit) {
        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.max(1, parseInt(limit, 10) || 10);
        const skip = (currentPage - 1) * pageSize;

        const totalRecords = await Customer.countDocuments(query);
        const totalPages = Math.ceil(totalRecords / pageSize) || 1;

        const customers = await Customer.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize);

        return res.status(200).json({
            data: customers,
            pagination: {
                totalRecords,
                currentPage,
                totalPages,
                pageSize
            }
        });
    }

    // Otherwise, return full array for non-paginated legacy callers (e.g. dropdowns in Order creation)
    const customers = await Customer.find(query).sort({ createdAt: -1 });
    res.status(200).json(customers);
});

// 4. GETTING CUSTOMER BY ID
const getCustomerById = asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }
    res.status(200).json(customer);
});

// 5. UPDATING CUSTOMER (With Profile Photo & WhatsApp Update)
const updateCustomer = asyncHandler(async (req, res) => {
    let { name, phone, whatsapp, address, city, measurements, pin, cnic, stitchingPreferences } = req.body;

    if (typeof measurements === 'string') {
        try {
            measurements = JSON.parse(measurements);
        } catch (e) {
            console.error('Error parsing measurements:', e);
        }
    }

    if (typeof stitchingPreferences === 'string') {
        try {
            stitchingPreferences = JSON.parse(stitchingPreferences);
        } catch (e) {
            console.error('Error parsing stitchingPreferences:', e);
        }
    }
    
    let customer = await Customer.findById(req.params.id);

    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    // Handle profile image update
    if (req.file) {
        if (customer.profileImage && customer.profileImage.public_id) {
            await deleteUploadedImage(customer.profileImage.public_id);
        }
        const { imageUrl, imagePublicId } = getImageMetadata(req.file);
        customer.profileImage = { url: imageUrl, public_id: imagePublicId };
    }

    customer.name = name !== undefined ? name : customer.name;
    customer.phone = phone !== undefined ? phone : customer.phone;
    customer.whatsapp = whatsapp !== undefined ? whatsapp : customer.whatsapp;
    customer.address = address !== undefined ? address : customer.address;
    customer.city = city !== undefined ? city : customer.city;
    customer.cnic = cnic !== undefined ? cnic : customer.cnic;
    if (measurements) customer.measurements = measurements;
    if (stitchingPreferences !== undefined) customer.stitchingPreferences = stitchingPreferences;
    if (pin) customer.pin = pin;

    const updatedCustomer = await customer.save();
    res.status(200).json(updatedCustomer);
});

// 6. DELETING CUSTOMER
const deleteCustomer = asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    if (customer.profileImage && customer.profileImage.public_id) {
        await deleteUploadedImage(customer.profileImage.public_id);
    }

    await CustomerLedger.deleteMany({ customer: customer._id });
    await customer.deleteOne();
    res.status(200).json({ message: 'Customer deleted successfully' });
});

// 7. SEARCHING CUSTOMER BY PHONE NUMBER
const searchCustomerByPhone = asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ phone: req.params.phone });
    res.status(200).json(customer);
});

// 8. UPDATING MEASUREMENTS WITH AUTOMATIC VERSION HISTORY
const updateMeasurements = asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    let itemsToProcess = [];
    if (Array.isArray(req.body.measurements)) {
        itemsToProcess = req.body.measurements;
    } else if (Array.isArray(req.body)) {
        itemsToProcess = req.body;
    } else if (req.body.category && req.body.data) {
        itemsToProcess = [req.body];
    } else if (req.body.category) {
        itemsToProcess = [{ category: req.body.category, data: req.body.data || {}, notes: req.body.notes, preferences: req.body.preferences }];
    }

    if (itemsToProcess.length === 0) {
        res.status(400);
        throw new Error('Measurement category and data are required');
    }

    if (!customer.measurements) {
        customer.measurements = [];
    }

    for (const item of itemsToProcess) {
        const { category, data, preferences, notes } = item;
        if (!category) continue;

        const cleanData = data || {};

        let catIndex = customer.measurements.findIndex(
            m => m.category && m.category.toLowerCase() === category.toLowerCase()
        );

        if (catIndex > -1) {
            // Existing category -> Archive previous state into history
            const currentCat = customer.measurements[catIndex];
            const prevHistory = currentCat.history || [];
            const nextVersionNumber = prevHistory.length + 1;

            prevHistory.push({
                version: nextVersionNumber,
                data: currentCat.data || {},
                preferences: currentCat.preferences || [],
                notes: currentCat.notes || `Version ${nextVersionNumber}`,
                recordedAt: currentCat.lastUpdated || new Date()
            });

            customer.measurements[catIndex].data = cleanData;
            customer.measurements[catIndex].preferences = preferences || currentCat.preferences || [];
            if (notes !== undefined) customer.measurements[catIndex].notes = notes;
            customer.measurements[catIndex].lastUpdated = new Date();
            customer.measurements[catIndex].history = prevHistory;
        } else {
            // New category -> Create fresh
            customer.measurements.push({
                category,
                data: cleanData,
                preferences: preferences || [],
                notes: notes || '',
                lastUpdated: new Date(),
                history: []
            });
        }
    }

    await customer.save();
    res.status(200).json(customer);
});

// 8.1 DELETE MEASUREMENT CATEGORY
const deleteMeasurementCategory = asyncHandler(async (req, res) => {
    const { id, category } = req.params;
    const customer = await Customer.findById(id);

    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    if (!customer.measurements || customer.measurements.length === 0) {
        res.status(400);
        throw new Error('No measurements found for this customer');
    }

    const decodedCategory = decodeURIComponent(category).toLowerCase();
    customer.measurements = customer.measurements.filter(
        m => m.category && m.category.toLowerCase() !== decodedCategory
    );

    await customer.save();
    res.status(200).json({ 
        message: 'Measurement category deleted successfully', 
        measurements: customer.measurements 
    });
});

// 9. GET FULL CUSTOMER PROFILE & METRIC INSIGHTS
const getCustomerProfile = asyncHandler(async (req, res) => {
    const customerId = req.params.id;
    const customer = await Customer.findById(customerId);

    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    // Orders History
    const orders = await Order.find({ customer: customerId }).sort({ bookingDate: -1 });

    // Khata Ledger Entries
    const ledger = await CustomerLedger.find({ customer: customerId }).sort({ date: -1, createdAt: -1 });

    let totalSpent = 0;
    let activeOrdersCount = 0;
    let latestActiveStatus = '';

    orders.forEach(o => {
        totalSpent += (o.totalAmount || 0);
        if (o.orderStatus !== 'Completed' && o.orderStatus !== 'Cancelled' && o.orderStatus !== 'Delivered') {
            activeOrdersCount++;
            if (!latestActiveStatus) {
                latestActiveStatus = o.orderStatus;
            }
        }
    });

    // Find latest measurement modified date across all categories
    let latestMeasurementDate = null;
    if (customer.measurements && customer.measurements.length > 0) {
        const dates = customer.measurements.map(m => new Date(m.lastUpdated).getTime()).filter(d => !isNaN(d));
        if (dates.length > 0) {
            latestMeasurementDate = new Date(Math.max(...dates));
        }
    }

    const metricsData = {
        totalOrders: orders.length,
        totalOrdersCount: orders.length,
        totalSpent,
        khataBalance: customer.khataBalance || 0,
        latestMeasurementDate,
        activeOrdersCount,
        latestOrderStatus: latestActiveStatus || 'No Active Orders',
        latestActiveStatus: latestActiveStatus || 'No Active Orders'
    };

    res.status(200).json({
        customer,
        orders,
        ledger,
        metrics: metricsData,
        stats: metricsData
    });
});

// 10. GET CUSTOMER KHATA STATEMENT & LEDGER
const getCustomerLedger = asyncHandler(async (req, res) => {
    const customerId = req.params.id;
    const customer = await Customer.findById(customerId).select('name customerNumber phone whatsapp address khataBalance');

    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    const ledgerEntries = await CustomerLedger.find({ customer: customerId })
        .sort({ date: -1, createdAt: -1 });

    res.status(200).json({
        customer,
        khataBalance: customer.khataBalance || 0,
        entries: ledgerEntries
    });
});

// 11. MANUAL SETTLEMENT / RECORD PAYMENT / REFUND ON KHATA
const settleCustomerKhata = asyncHandler(async (req, res) => {
    const customerId = req.params.id;
    const { type, amount, description } = req.body;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
        res.status(400);
        throw new Error('Valid amount is required');
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    let currentBalance = Number(customer.khataBalance) || 0;
    let newBalance = currentBalance;
    let entryType = type || 'payment';

    if (entryType === 'payment') {
        newBalance = currentBalance - numAmount;
    } else if (entryType === 'refund') {
        newBalance = currentBalance + numAmount;
    } else if (entryType === 'debit') {
        newBalance = currentBalance + numAmount;
    } else if (entryType === 'credit') {
        newBalance = currentBalance - numAmount;
    }

    const ledgerEntry = await CustomerLedger.create({
        customer: customerId,
        type: entryType,
        amount: numAmount,
        runningBalance: newBalance,
        description: description || (entryType === 'payment' ? 'Cash payment received on counter' : 'Refund / Khata adjustment')
    });

    customer.khataBalance = newBalance;
    await customer.save();

    res.status(200).json({
        message: 'Khata updated successfully',
        khataBalance: newBalance,
        entry: ledgerEntry
    });
});

// 12. QUICK LOOKUP KHATA BALANCE BY PHONE OR ID
const getCustomerKhataBalance = asyncHandler(async (req, res) => {
    const { identifier } = req.params;
    let customer;

    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
        customer = await Customer.findById(identifier).select('name customerNumber phone khataBalance');
    } else {
        customer = await Customer.findOne({ phone: identifier }).select('name customerNumber phone khataBalance');
    }

    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    res.status(200).json({
        _id: customer._id,
        customerNumber: customer.customerNumber,
        name: customer.name,
        phone: customer.phone,
        khataBalance: customer.khataBalance || 0
    });
});

module.exports = { 
    createCustomer, 
    loginCustomer, 
    getCustomers, 
    getCustomerById, 
    updateCustomer, 
    deleteCustomer, 
    searchCustomerByPhone, 
    updateMeasurements,
    deleteMeasurementCategory,
    getCustomerProfile,
    getCustomerLedger,
    settleCustomerKhata,
    getCustomerKhataBalance
};