const mongoose = require('mongoose');

const tailoringServiceSchema = new mongoose.Schema({
    itemType: {
        type: String,
        enum: ['service', 'customization'],
        default: 'service' // 'service' (Garment Category e.g. Shalwar Qameez with base rate) | 'customization' (Add-on e.g. Jali Kanta 400)
    },
    serviceName: {
        type: String,
        required: true,
        trim: true // e.g. "Shalwar Qameez", "Kurta", "Jali Kanta"
    },
    price: {
        type: Number,
        required: true,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('TailoringService', tailoringServiceSchema);
