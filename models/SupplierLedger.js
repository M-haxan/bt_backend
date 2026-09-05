const mongoose = require('mongoose');

const supplierLedgerSchema = new mongoose.Schema({
    supplier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        required: [true, 'Supplier reference is required']
    },
    date: {
        type: Date,
        default: Date.now
    },
    itemDetails: {
        type: String,
        required: [true, 'Item description/details are required'],
        trim: true
    },
    type: {
        type: String,
        enum: ['purchase', 'payment'],
        required: true
    },
    amount: {
        type: Number,
        required: [true, 'Transaction amount is required'],
        min: [0, 'Amount cannot be negative']
    },
    paymentStatus: {
        type: String,
        enum: ['Paid', 'Unpaid', 'Partial'],
        default: 'Unpaid'
    },
    paymentMethod: {
        type: String,
        enum: ['Cash', 'Bank Transfer', 'JazzCash/EasyPaisa', 'Cheque', 'Credit'],
        default: 'Cash'
    },
    notes: {
        type: String,
        trim: true,
        default: ''
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('SupplierLedger', supplierLedgerSchema);
