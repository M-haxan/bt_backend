const Customer = require('../models/Customer');
const asyncHandler = require('../middleware/asyncHandler');
// Cloudinary helpers import kiye
const { getImageMetadata, deleteUploadedImage } = require('../config/cloudinary'); 
// JWT import kiya (Token banane ke liye)
const jwt = require('jsonwebtoken');

// Token generate karne ka function
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// 1. CREATING CUSTOMER (With Profile Photo & PIN)
const createCustomer = asyncHandler(async (req, res) => {
    const { name, phone, address, measurements, pin, cnic } = req.body;

    // Check if customer already exists
    const customerExists = await Customer.findOne({ phone });
    if (customerExists) {
        res.status(400);
        throw new Error('Customer already exists');
    }

    // Profile Image handling
    let profileImage = { url: null, publicId: null };
    if (req.file) {
        const { imageUrl, imagePublicId } = getImageMetadata(req.file);
        profileImage = { url: imageUrl, publicId: imagePublicId };
    }

    // Add new customer
    const customer = await Customer.create({ 
        name, 
        phone, 
        address, 
        measurements, 
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

    // Check if customer exists AND pin matches (using matchPin from model)
    if (customer && (await customer.matchPin(pin))) {
        res.json({
            _id: customer._id,
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

// 3. GETTING ALL CUSTOMERS
const getCustomers = asyncHandler(async (req, res) => {
    const customers = await Customer.find().sort({ createdAt: -1 });
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

// 5. UPDATING CUSTOMER (With Profile Photo Update)
const updateCustomer = asyncHandler(async (req, res) => {
    const { name, phone, address, measurements, pin, cnic } = req.body;
    
    // Yahan humne findByIdAndUpdate ki jagah findById use kiya hai
    // Taake agar PIN update ho, toh Model ka .pre('save') middleware chal sake
    let customer = await Customer.findById(req.params.id);

    if (!customer) {
        res.status(404);
        throw new Error('Customer not found');
    }

    // Handle profile image update
    if (req.file) {
        // Purani image Cloudinary se delete karo
        if (customer.profileImage && customer.profileImage.publicId) {
            await deleteUploadedImage(customer.profileImage.publicId);
        }
        // Nayi image save karo
        const { imageUrl, imagePublicId } = getImageMetadata(req.file);
        customer.profileImage = { url: imageUrl, publicId: imagePublicId };
    }

    // Baqi fields update karo
    customer.name = name || customer.name;
    customer.phone = phone || customer.phone;
    customer.address = address || customer.address;
    customer.cnic = cnic !== undefined ? cnic : customer.cnic;
    if (measurements) customer.measurements = measurements;
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

    // Delete profile photo from Cloudinary before deleting customer
    if (customer.profileImage && customer.profileImage.publicId) {
        await deleteUploadedImage(customer.profileImage.publicId);
    }

    await customer.deleteOne();
    res.status(200).json({ message: 'Customer deleted successfully' });
});

// 7. SEARCHING CUSTOMER BY PHONE NUMBER
const searchCustomerByPhone = asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ phone: req.params.phone });
    res.status(200).json(customer);
});

// 8. UPDATING MEASUREMENTS
const updateMeasurements = asyncHandler(async (req, res) => {
    const { measurements } = req.body;
    const customer = await Customer.findByIdAndUpdate(req.params.id, { measurements }, { new: true });
    res.status(200).json(customer);
});

// Exports mein 'loginCustomer' laazmi add karein
module.exports = { 
    createCustomer, 
    loginCustomer, 
    getCustomers, 
    getCustomerById, 
    updateCustomer, 
    deleteCustomer, 
    searchCustomerByPhone, 
    updateMeasurements 
};