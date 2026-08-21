const mongoose = require('mongoose');

const workerLedgerSchema = new mongoose.Schema({
    worker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Worker',
        required: true
    },
    type: {
        type: String,
        enum: ['suit', 'advance'],
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    amount: {
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
    suitId: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['Pending', 'Paid'],
        default: 'Pending'
    },
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WorkerPayment',
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('WorkerLedger', workerLedgerSchema);
