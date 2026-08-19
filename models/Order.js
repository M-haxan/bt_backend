//import mongoose
const mongoose = require('mongoose');
//creating schema
const orderSchema = new mongoose.Schema({
    orderNumber: { type: Number, unique: true }, 
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    // creating suits array to store multiple suits in one order
    suits: [{
        fabricDetails: { type: String, required: true },
        volumeNo:{ type: String, required: true },
        staticTags:[],
        customDesign: {type: String},
        designImage: {type: String},
        fabricImage: {
            url: { type: String },
            publicId: { type: String }
        },
        price: {type: Number, required: true},
        wearer: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Customer' 
        },
        assignedWorker: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Worker' 
        },
        stitchingStatus: { 
            type: String, 
            enum: ['Pending', 'Assigned', 'Stitched'], 
            default: 'Pending' 
        }
    }],
    alterations:[{
        description: { type: String },
        price: { type: Number },
        wearer: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Customer' }
    }],

   totalAmount: { type: Number },
   advancePaid: { type: Number },
   balanceAmount: { type: Number },
   bookingDate: { type: Date, default: Date.now },
   deliveryDate: { type: Date },
   orderStatus: { type: String, enum: ['Pending', 'In Progress', 'Completed', 'Cancelled'], default: 'Pending' }
});
module.exports = mongoose.model('Order', orderSchema);