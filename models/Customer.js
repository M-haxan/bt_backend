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
    measurements: [{
        category: {
            type: String,
        },
        data: { type: Map, of: String }, // e.g., { "Length": "40", "Chest": "22" } 
        lastUpdated: { type: Date, default: Date.now }
    }
    ]


})

module.exports = mongoose.model('Customer', customerSchema);    