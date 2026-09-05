const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Expense title is required'],
        trim: true
    },
    category: {
        type: String,
        enum: [
            'Material & Supplies',
            'Shop Rent',
            'Electricity & Utilities',
            'Machine Maintenance & Oil',
            'Tea & Refreshment',
            'Worker Food / Daily Allowance',
            'Staff Salary / Other Labor',
            'Packaging & Bags',
            'Misc & General'
        ],
        default: 'Misc & General'
    },
    amount: {
        type: Number,
        required: [true, 'Expense amount is required'],
        min: [0, 'Amount cannot be negative']
    },
    date: {
        type: Date,
        default: Date.now
    },
    paidTo: {
        type: String,
        trim: true,
        default: ''
    },
    paymentMethod: {
        type: String,
        enum: ['Cash', 'Bank Transfer', 'JazzCash/EasyPaisa', 'Other'],
        default: 'Cash'
    },
    supplierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        default: null
    },
    notes: {
        type: String,
        trim: true,
        default: ''
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Expense', expenseSchema);
