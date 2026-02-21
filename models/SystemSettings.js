const mongoose = require('mongoose');

// قائمة العملات المدعومة
const SUPPORTED_CURRENCIES = [
    { code: 'SAR', symbol: 'ر.س',  name: 'ريال سعودي',      position: 'after'  },
    { code: 'EGP', symbol: 'ج.م',  name: 'جنيه مصري',        position: 'after'  },
    { code: 'USD', symbol: '$',     name: 'دولار أمريكي',     position: 'before' },
    { code: 'EUR', symbol: '€',     name: 'يورو',              position: 'before' },
    { code: 'GBP', symbol: '£',     name: 'جنيه إسترليني',   position: 'before' },
    { code: 'AED', symbol: 'د.إ',  name: 'درهم إماراتي',     position: 'after'  },
    { code: 'KWD', symbol: 'د.ك',  name: 'دينار كويتي',      position: 'after'  },
    { code: 'QAR', symbol: 'ر.ق',  name: 'ريال قطري',        position: 'after'  },
    { code: 'BHD', symbol: 'د.ب',  name: 'دينار بحريني',     position: 'after'  },
    { code: 'OMR', symbol: 'ر.ع',  name: 'ريال عُماني',      position: 'after'  },
    { code: 'JOD', symbol: 'د.أ',  name: 'دينار أردني',      position: 'after'  },
    { code: 'MAD', symbol: 'د.م',  name: 'درهم مغربي',       position: 'after'  },
    { code: 'TRY', symbol: '₺',    name: 'ليرة تركية',       position: 'before' },
];

const systemSettingsSchema = new mongoose.Schema({
    academyName:        { type: String, default: 'منصة انطلق التعليمية' },
    academyEmail:       { type: String, default: 'info@academy.com' },
    academyPhone:       { type: String, default: '+966' },
    address:            { type: String, default: 'المملكة العربية السعودية' },
    taxPercentage:      { type: Number, default: 0 },
    registrationStatus: { type: Boolean, default: true },
    logo:               { type: String },
    footerText:         { type: String, default: 'جميع الحقوق محفوظة' },

    // ====== إعدادات العملة ======
    currencyCode:     { type: String, default: 'SAR' },   // ISO 4217
    currencySymbol:   { type: String, default: 'ر.س' },   // الرمز للعرض
    currencyPosition: { type: String, default: 'after', enum: ['before', 'after'] },
    // الحقل القديم للتوافق الرجعي
    currency:         { type: String, default: 'ر.س' },

    socialLinks: {
        facebook:  String,
        twitter:   String,
        instagram: String,
        whatsapp:  String
    },
    supportContact: {
        student:    String,
        teacher:    String,
        supervisor: String
    },
    academyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Academy', required: true }
}, { timestamps: true });

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

module.exports = SystemSettings;
module.exports.SUPPORTED_CURRENCIES = SUPPORTED_CURRENCIES;
