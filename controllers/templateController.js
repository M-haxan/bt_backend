//importing template model
const Template = require('../models/Template');
//importing async handler
const asyncHandler = require('../middleware/asyncHandler');
//creating template
const createTemplate = asyncHandler(async (req, res) => {
    const { categoryname, fields } = req.body;
    const template = await Template.create({ categoryname, fields });
    res.status(201).json(template);
});
//getting all templates
const getTemplates = asyncHandler(async (req, res) => {
    const templates = await Template.find();
    res.status(200).json(templates);
});

//updating template
const updateTemplate = asyncHandler(async (req, res) => {
    const { categoryname, fields } = req.body;
    const template = await Template.findByIdAndUpdate(req.params.id, { categoryname, fields }, { new: true });
    res.status(200).json(template);
});
//deleting template
const deleteTemplate = asyncHandler(async (req, res) => {
    const template = await Template.findByIdAndDelete(req.params.id);
    res.status(200).json(template);
});
//exporting template controllers
module.exports = { createTemplate, getTemplates, updateTemplate, deleteTemplate }; 