// models/Booking.js

const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    startDate: { type: Date }, // تاريخ بداية الكورس المؤكد
    

    // 💡 مصفوفة لتخزين الجدولة
    sessions: [{
        durationMinutes: { type: Number(), default:Number(this.selectedPriceOption)  },
        date: { type: Date, required: true },
        time: { type: String, required: true },
          endtime: { type: String },
        link: { type: String } ,
        attended: { type: Boolean, default: false },
// تقرير أداء الطالب في هذه الحصة
        report: {
            level: { type: String, enum: ['A', 'B', 'C'] }, // التقييم (ممتاز، متوسط، ضعيف)
            content: { type: String },                      // ما تم إنجازه
            instructions: { type: String },                 // توجيهات للطالب
            homeworkFile: { type: String },                 // اسم ملف الواجب المرفوع
            submittedAt: { type: Date }                     // وقت إرسال التقرير
        },

        status: { type: String, enum: ['pending', 'completed', 'missed'], default: 'pending' }
        // يمكنك إضافة رابط الجلسة هنا لاحقًا
    }],
    // مرجع لموديل الطالب/المستخدم
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user', // افترض أن لديك موديل User
        required: true
    },
    // مرجع لموديل الكورس
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    // ID خيار التسعير المُختار من مصفوفة pricingOptions
    selectedPriceOption: {
        type: String,
        required: true,
      
    },
    numberOfSessionsPerMonth: { // العدد الإجمالي للحصص التي تم حجزها
        type: Number,
        required: true,
        min: 1
    },
    totalAmount: { // المبلغ المدفوع
        type: Number,
        required: true,
        min: 0
    },
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user', // افترض أن لديك موديل User
       
    },
    status: { // حالة الحجز (بانتظار الدفع، مؤكد، ملغي، مكتمل)
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'completed'],
        default: 'pending'
    },
    paymentDetails: {
        transactionId: String,
        method: String
    }
}, { timestamps: true });
const Subscription = mongoose.model('Subscription', bookingSchema);
module.exports = Subscription;
