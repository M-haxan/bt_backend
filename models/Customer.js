//importing mongoose
const mongoose = require('mongoose');

//creating schema
const customerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    phone: {
        type: Number,
        required: true
    },
    address: {
        type: String,

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
        lastUpdated: { type: Date, default: Date.now }
    }],
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