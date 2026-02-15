const mongoose = require('mongoose');

const websiteSectionSchema = new mongoose.Schema({
    key: { type: String, required: true }, // e.g., 'hero', 'about', 'services'
    title: { type: String, required: true },
    subtitle: { type: String },
    content: { type: String },
    image: { type: String },
    buttonText: { type: String },
    buttonLink: { type: String },
    isActive: { type: Boolean, default: true },
    academyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Academy', required: true }
}, { timestamps: true });

// Ensure unique key per academy
websiteSectionSchema.index({ key: 1, academyId: 1 }, { unique: true });

const WebsiteSection = mongoose.model('WebsiteSection', websiteSectionSchema);

module.exports = WebsiteSection;
