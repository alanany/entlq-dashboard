const mongoose = require('mongoose');

const websiteSectionSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true }, // e.g., 'hero', 'about', 'services'
    title: { type: String, required: true },
    subtitle: { type: String },
    content: { type: String },
    image: { type: String },
    buttonText: { type: String },
    buttonLink: { type: String },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

const WebsiteSection = mongoose.model('WebsiteSection', websiteSectionSchema);

module.exports = WebsiteSection;
