const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    // Generic Fields
    type: { type: String, enum: ['income', 'expense'], required: true }, 
    category: { type: String, enum: ['subscription', 'salary', 'other'], default: 'other' },
    amount: { type: Number, required: true },
    status: { type: String, default: 'completed' }, // completed, pending, failed
    date: { type: Date, default: Date.now },
    description: String,

    // Relations
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'user' }, // Payer
    toUser: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },   // Payee
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
    
    // Legacy / Specific Fields (Keep for compatibility but make optional)
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    month: { type: String }, // e.g., "2024-05" for salaries
    paymentDate: { type: Date, default: Date.now }, // Legacy alias for date
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    academyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Academy', required: true },

}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);