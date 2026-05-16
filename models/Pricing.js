const mongoose = require('mongoose');

const pricingSchema = new mongoose.Schema({
    serviceName: {
        type: String,
        required: true,
        trim: true // e.g., "Shalwar Qameez", "Kurta", "Designer Shirt"
    },
    description: {
        type: String,
        trim: true // e.g., "Simple design, Fancy collar, or Double stitching"
    },
    minPrice: {
        type: Number,
        required: true // e.g., 1200
    },
    maxPrice: {
        type: Number,
        required: true // e.g., 1400
    },
    deliveryTime: {
        type: String,
        default: 'Standard (3-5 Days)'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Pricing', pricingSchema);