const mongoose = require('mongoose');

const pricingSchema = new mongoose.Schema({
    serviceName: {
        type: String,
        required: true,
        trim: true // e.g. "Kurta Stitching", "Shalwar Kameez", "Waistcoat"
    },
    description: {
        type: String,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        default: 0
    },
    deliveryTime: {
        type: String,
        default: 'Standard (3-5 Days)'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Pricing', pricingSchema);