
const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'اسم القسم مطلوب'],
        unique: true,
        trim: true
    },
    slug: { // يمكن استخدامه لعناوين URL النظيفة
        type: String,
        unique: true,
        lowercase: true
    },
    // يمكن إضافة حقول أخرى مثل creator أو dateCreated
    academyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Academy',
        required: true
    }
});

// 💡 يمكنك إضافة منطق لإنشاء الـ slug قبل الحفظ
CategorySchema.pre('save', function(next) {
    if (this.isModified('name')) {
        this.slug = this.name.replace(/\s+/g, '-'); // تحويل الاسم إلى slug (قد تحتاج مكتبة للتعامل مع الأحرف العربية)
    }
    next();
});

module.exports = mongoose.model('Category', CategorySchema);