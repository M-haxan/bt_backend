//importing mongoose
const mongoose = require('mongoose');
//creating schema for measurement template 
const templateSchema = new mongoose.Schema({
   categoryname: {
    type: String,
    required: true
   },
   fields:[{type: String, required: true}]
})

module.exports = mongoose.model('Template', templateSchema);
