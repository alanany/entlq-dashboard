// Course.js (نموذج Mongoose)
const mongoose=require("mongoose");

const LessonSchema = new mongoose.Schema({
    title: { type: String, required: true },
    // videoUrl: String,
});

const SectionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    lessons: [LessonSchema] // مصفوفة من الدروس
});

const CourseSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },

    level: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
    category:  { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    isPublished: { type: Boolean, default: true },
   pricingOptions: {
        type: [
            {
                duration: { type: Number, required: true }, // مثال: 30, 40, 60
                price: { type: Number, required: true }    // سعر الحصة لهذه المدة
            }
        ],
        required: true,
      
    },
   
    curriculum: [SectionSchema], // مصفوفة من الأقسام
    // creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const Course = mongoose.model('Course', CourseSchema);
module.exports = Course;