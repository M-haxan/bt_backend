//import mongoose
const mongoose = require('mongoose');
//creating schema
const orderSchema = new mongoose.Schema({
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    // creating suits array to store multiple suits in one order
    suits: [{
        fabricDetails: { type: String, required: true },
        volumeNo:{ type: String, required: true },
        staticTags:[],
        customDesign: {type: String},
        designImage: {type: String},
        price: {type: Number, required: true},
    }],
   totalAmount: { type: Number },
   advancePaid: { type: Number },
   balanceAmount: { type: Number },
   bookingDate: { type: Date, default: Date.now },
   deliveryDate: { type: Date },
   orderStatus: { type: String, enum: ['Pending', 'In Progress', 'Completed', 'Cancelled'], default: 'Pending' }
});
module.exports = mongoose.model('Order', orderSchema);