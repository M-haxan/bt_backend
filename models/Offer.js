const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    desc: {
        type: String,
        required: true,
        trim: true
    },
    details: {
        type: [String],
        default: []
    },
    imageUrl: {
        type: String,
        required: true
    },
    imagePublicId: {
        type: String,
        default: null
    },
    order: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Offer', offerSchema);
