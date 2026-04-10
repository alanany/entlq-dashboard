const { EntitySchema } = require('typeorm');

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

const SystemSettingsEntity = new EntitySchema({
    name: 'SystemSettings',
    tableName: 'system_settings',
    columns: {
        id: {
            primary: true,
            type: 'int',
            generated: true
        },
        academyName: {
            type: 'varchar',
            default: 'منصة انطلق التعليمية'
        },
        academyEmail: {
            type: 'varchar',
            default: 'info@academy.com'
        },
        academyPhone: {
            type: 'varchar',
            default: '+966'
        },
        address: {
            type: 'varchar',
            default: 'المملكة العربية السعودية'
        },
        taxPercentage: {
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0
        },
        registrationStatus: {
            type: 'boolean',
            default: true
        },
        logo: {
            type: 'varchar',
            nullable: true
        },
        footerText: {
            type: 'varchar',
            default: 'جميع الحقوق محفوظة'
        },
        currencyCode: {
            type: 'varchar',
            default: 'SAR'
        },
        currencySymbol: {
            type: 'varchar',
            default: 'ر.س'
        },
        currencyPosition: {
            type: 'enum',
            enum: ['before', 'after'],
            default: 'after'
        },
        currency: { // legacy 
            type: 'varchar',
            default: 'ر.س'
        },
        socialLinks: {
            type: 'json',
            nullable: true // stores { facebook, twitter, instagram, whatsapp }
        },
        supportContact: {
            type: 'json',
            nullable: true // stores { student, teacher, supervisor }
        },
        createdAt: {
            type: 'timestamp',
            createDate: true
        },
        updatedAt: {
            type: 'timestamp',
            updateDate: true
        }
    },
    relations: {
        academy: {
            target: 'Academy',
            type: 'many-to-one',
            joinColumn: { name: 'academyId' },
            nullable: false,
            onDelete: 'CASCADE'
        }
    }
});

module.exports = SystemSettingsEntity;
module.exports.SUPPORTED_CURRENCIES = SUPPORTED_CURRENCIES;
