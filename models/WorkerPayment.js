const mongoose = require('mongoose');

const workerPaymentSchema = new mongoose.Schema({
    worker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Worker',
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    paymentDate: {
        type: Date,
        default: Date.now
    },
    totalEarned: {
        type: Number,
        required: true
    },
    totalAdvance: {
        type: Number,
        required: true
    },
    netPaid: {
        type: Number,
        required: true
    },
    notes: {
        type: String,
        default: ''
    }
}, { timestamps: true });

module.exports = mongoose.model('WorkerPayment', workerPaymentSchema);
