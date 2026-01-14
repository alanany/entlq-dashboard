// models/Payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    month: { type: String, required: true }, // مثال: "يناير 2024"
    paymentDate: { type: Date, default: Date.now },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, default: 'paid' },
    // داخل SubscriptionSchema
sessions: [{
    date: Date,
    time: String,
    status: String, // 'completed', 'pending', etc.
    attended: Boolean,
    isPaidByAdmin: { type: Boolean, default: false } // أضف هذا الحقل هنا
}],
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);