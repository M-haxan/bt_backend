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
        // Stage 1: Cutting
        cutting: {
            isSelf: { type: Boolean, default: true },
            assignedWorker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', default: null },
            status: { type: String, enum: ['Pending', 'In Progress', 'Completed'], default: 'Pending' },
            wage: { type: Number, default: 0 }
        },
        // Stage 2: Stitching (with QC approval)
        stitching: {
            isSelf: { type: Boolean, default: false },
            assignedWorker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', default: null },
            status: { 
                type: String, 
                enum: ['Pending', 'Assigned', 'Submitted for Inspection', 'Approved', 'Rework Required'], 
                default: 'Pending' 
            },
            reworkNotes: { type: String, default: '' },
            wage: { type: Number, default: 0 },
            approvedAt: { type: Date, default: null }
        },
        // Stage 3: Finishing / Pressing
        finishing: {
            isSelf: { type: Boolean, default: true },
            assignedWorker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', default: null },
            status: { type: String, enum: ['Pending', 'In Progress', 'Completed'], default: 'Pending' },
            wage: { type: Number, default: 0 }
        },
        // Backward compatibility fields
        assignedWorker: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Worker' 
        },
        stitchingStatus: { 
            type: String, 
            enum: ['Pending', 'Assigned', 'Submitted for Inspection', 'Stitched', 'Rework Required'], 
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
   orderStatus: { 
       type: String, 
       enum: ['Pending', 'In Progress', 'Completed', 'Delivered', 'Cancelled'], 
       default: 'Pending' 
   },
   // Payment received when delivering / handing over the suit
   receivedAtDelivery: {
       amount: { type: Number, default: 0 },
       date: { type: Date, default: null },
       paymentMethod: { type: String, default: 'Cash' }
   },
   // If previous customer Khata was adjusted on this order booking
   previousKhataAdjusted: {
       type: { 
           type: String, 
           enum: ['none', 'added_due', 'deducted_advance'], 
           default: 'none' 
       },
       amount: { type: Number, default: 0 }
   }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);