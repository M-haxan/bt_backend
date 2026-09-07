//importing mongoose
const mongoose = require('mongoose');

//creating schema
const customerSchema = new mongoose.Schema({
    customerNumber: {
        type: Number,
        unique: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: Number,
        required: true
    },
    whatsapp: {
        type: String,
        trim: true,
        default: ''
    },
    address: {
        type: String,
        trim: true,
        default: ''
    },
    city: {
        type: String,
        trim: true,
        default: ''
    },
    pin:{
        type: Number,
    },
    cnic: {
        type: String,
        required: false
    },
    //adding profile image url and public id
    profileImage: {
        url: { type: String },
        public_id: { type: String }
    },
    measurements: [{
        category: {
            type: String,
        },
        data: { type: Map, of: String }, // e.g., { "Length": "40", "Chest": "22" } 
        preferences: [{type: String}], // e.g., ["ban, kaf pockets]
        lastUpdated: { type: Date, default: Date.now },
        history: [{
            version: { type: Number },
            data: { type: Map, of: String },
            preferences: [{ type: String }],
            notes: { type: String, default: '' },
            recordedAt: { type: Date, default: Date.now }
        }]
    }],
    // Customer Stitching & Style Preferences (Permanent Profile)
    stitchingPreferences: {
        collar: { type: String, default: '' }, // e.g. Half Bain, Full Bain, Shirt Collar, Cut Bain, No Collar
        sleeves: { type: String, default: '' }, // e.g. Gol Bazu (گول بازو), Sada Open Astin, Single Cuff, Double Cuff
        daman: { type: String, default: '' }, // e.g. Gol Daman, Choras Daman
        frontPocket: { type: String, default: '' }, // e.g. 1 Front Pocket, 2 Front Pockets, No Front Pocket
        sidePockets: { type: String, default: '' }, // e.g. 1 Side Pocket (Right), 2 Side Pockets, No Side Pocket
        shalwarPocket: { type: String, default: '' }, // e.g. 1 Shalwar Pocket, 2 Shalwar Pockets, Zip Pocket, No Shalwar Pocket
        patti: { type: String, default: '' }, // e.g. Normal Patti, Gum Patti, Half Patti
        stitchingStyle: { type: String, default: '' }, // e.g. Single Silai, Double Silai, Fancy Dhaga
        customNotes: { type: String, default: '' }, // Extra fitting / tailor instructions
        otherPreferences: { type: String, default: '' }, // Custom user defined preference
        tags: [{ type: String }] // Selected preference tags
    },
    // Running Khata Balance (Positive = Customer owes shop, Negative = Shop owes customer)
    khataBalance: {
        type: Number,
        default: 0
    }
}, { timestamps: true });
// PIN check karne ka function (Customer Login ke waqt kaam aayega)
customerSchema.methods.matchPin = async function (enteredPin) {
    return Number(enteredPin) === this.pin;
};

module.exports = mongoose.model('Customer', customerSchema);    