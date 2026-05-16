const mongoose = require('mongoose');

const catalogueSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    detail: { // Aapki requirement ke mutabiq
        type: String,
        required: true
    },
    imageUrl: {
        type: String,
        required: true 
    },
    imagePublicId: { 
        // Jab admin delete karega, toh Cloudinary se bhi image udane ke liye yeh ID chahiye hogi
        type: String,
        required: true 
    },
    category: {
        type: String,
        required: true,
        enum: ['Shalwar Qameez', 'Shirts', 'Kurta'] // Sirf yeh 3 allow hongi
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Catalogue', catalogueSchema);