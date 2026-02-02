const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
    academyName: { type: String, default: 'أكاديمية التعليم' },
    academyEmail: { type: String, default: 'info@academy.com' },
    academyPhone: { type: String, default: '+966' },
    currency: { type: String, default: 'ر.س' },
    address: { type: String, default: 'المملكة العربية السعودية' },
    taxPercentage: { type: Number, default: 0 },
    registrationStatus: { type: Boolean, default: true }, // Open or Close registration
    logo: { type: String },
    footerText: { type: String, default: 'جميع الحقوق محفوظة' },
    socialLinks: {
        facebook: String,
        twitter: String,
        instagram: String,
        whatsapp: String
    }
}, { timestamps: true });

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

module.exports = SystemSettings;
