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
    pin:{
        type: Number,
    },
    //adding profile image url and public id
    profileImage: {
        url: { type: String },
        public_id: { type: String }
    },
    measurements: [{
        category: {
            type: String,
        },
        data: { type: Map, of: String }, // e.g., { "Length": "40", "Chest": "22" } 
        preferences: [{type: String}], // e.g., ["ban, kaf pockets]
        lastUpdated: { type: Date, default: Date.now }
    }
    ]


})
// password save hone se pehle usko Encrypt (Hash) karna
customerSchema.pre('save', async function (next) {
    // Agar password change nahi hua toh aage barh jao
    if (!this.isModified('password')) { 
        next();
    }   
    // Password ko secure banane ka process
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Password check karne ka function (Login ke waqt kaam aayega)
customerSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Customer', customerSchema);    