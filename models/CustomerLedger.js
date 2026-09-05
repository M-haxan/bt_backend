const mongoose = require('mongoose');

const customerLedgerSchema = new mongoose.Schema({
    customer: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Customer', 
        required: true 
    },
    type: { 
        type: String, 
        enum: ['debit', 'credit', 'payment', 'refund', 'adjustment'], 
        required: true 
    },
    // Amount of this specific transaction
    amount: { 
        type: Number, 
        required: true 
    },
    // Customer's running balance after this transaction (Positive = Customer owes shop, Negative = Shop owes customer)
    runningBalance: { 
        type: Number, 
        required: true 
    },
    description: { 
        type: String, 
        required: true 
    },
    orderId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Order', 
        default: null 
    },
    orderNumber: { 
        type: Number, 
        default: null 
    },
    date: { 
        type: Date, 
        default: Date.now 
    }
}, { timestamps: true });

module.exports = mongoose.model('CustomerLedger', customerLedgerSchema);
