const mongoose = require('mongoose');

const academySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please enter academy name'],
        unique: true
    },
    subdomain: {
        type: String,
        unique: true,
        lowercase: true
    },
    logo: {
        type: String
    },
    settings: {
        primaryColor: { type: String, default: '#FE5D37' },
        currency: { type: String, default: 'USD' }
    },
    status: {
        type: String,
        enum: ['active', 'suspended'],
        default: 'active'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Academy = mongoose.model('Academy', academySchema);
module.exports = Academy;
