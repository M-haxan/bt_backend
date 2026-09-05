const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Supplier contact person or owner name is required'],
        trim: true
    },
    shopName: {
        type: String,
        required: [true, 'Shop/Business name is required'],
        trim: true
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true
    },
    category: {
        type: String,
        enum: ['Bukram & Canvas', 'Kaj & Buttons', 'Thread & Zips', 'Fabric & Linings', 'Machine & Parts', 'General Accessories', 'Other'],
        default: 'General Accessories'
    },
    address: {
        type: String,
        trim: true,
        default: ''
    },
    totalPurchases: {
        type: Number,
        default: 0
    },
    totalPaid: {
        type: Number,
        default: 0
    },
    balancePayable: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Supplier', supplierSchema);
