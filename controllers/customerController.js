// importing customer model
const Customer = require('../models/Customer');
// importing async handler
const asyncHandler = require('../middleware/asyncHandler');

//creating customer
const createCustomer = asyncHandler(async (req, res) => {
    const { name, phone, address, measurements } = req.body;
    //check if customer already exists
    const customer = await Customer.findOne({ phone });
    if (customer) {
        res.status(400);
        throw new Error('Customer already exists');
    }
    //add new customer
    const newCustomer = await Customer.create({ name, phone, address, measurements });
    res.status(201).json(newCustomer);
});
//getting all customers
const getCustomers = asyncHandler(async (req, res) => {
    const customers = await Customer.find();
    res.status(200).json(customers);
});

//getting customer by id
const getCustomerById = asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.params.id);
    res.status(200).json(customer);
});

//updating customer
const updateCustomer = asyncHandler(async (req, res) => {
    const { name, phone, address, measurements } = req.body;
    const customer = await Customer.findByIdAndUpdate(req.params.id, { name, phone, address }, { new: true });
    res.status(200).json(customer);
});

//deleting customer
const deleteCustomer = asyncHandler(async (req, res) => {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    res.status(200).json(customer);
});
//searching customer by phone number
const searchCustomerByPhone = asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ phone: req.params.phone });
    res.status(200).json(customer);
});
// updating measurements
const updateMeasurements = asyncHandler(async (req, res) => {
    const { measurements } = req.body;
    const customer = await Customer.findByIdAndUpdate(req.params.id, { measurements }, { new: true });
    res.status(200).json(customer);
});

module.exports = { createCustomer, getCustomers, getCustomerById, updateCustomer, deleteCustomer, updateMeasurements };