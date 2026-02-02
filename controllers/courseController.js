// في courseController.js
// GET - Show All Courses
const Category = require('../models/category_model.js');
const Course = require('../models/course_model.js');
const User = require('../models/user_model.js');

const api_coursesController = require('./api controllers/api_coursesController .js');
const Subscription= require('../models/subscription_model.js');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const {DateTime}  =require ("luxon");
const Payment = require('../models/Payment.js');
const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, 'uploads/');
        },
        filename: function (req, file, cb) {
            cb(null, Date.now() + '-' + file.originalname);
        }
    });
const upload = multer({ storage: storage });

const getAdminDashboard = async (req, res) => {
    console.log("admin dashboard at courseController");
    const stats = await getDashboardStats(req, res);
    console.log(stats,'stats'); 
    // 'dashboard/index' هو المسار النسبي للملف داخل مجلد 'views'
    res.render('dashboard/index', { title: 'لوحة تحكم الأدمن',stats:stats }); };



const getAllCourses = async (req, res) => {

 const courses = await Course.find();  console.log(courses);
    // 'dashboard/index' هو المسار النسبي للملف داخل مجلد 'views'
    res.render('dashboard/courses', { title: 'كورسات الموقع', courses: courses});    
}
const getAddCourse = async (req, res) => {
     const categories = await Category.find({})
                                         .select('name _id') // نختار الاسم والمعرّف فقط
                                         .lean();
    // 'dashboard/index' هو المسار النسبي للملف داخل مجلد 'views'
    res.render('dashboard/add-course', { title: 'اضافة كورس جديد',   
                 categories: categories
 }); 

};



// 2. دالة التحكم (Controller)
const addCourse = async (req, res) => {
    try {
        console.log(req.body);
        // استخراج البيانات النصية من req.body
        let  { title, description, level, category, pricingOptions, curriculum } = req.body;

        // 💡 تحويل النصوص إلى مصفوفات/كائنات (لأن FormData ترسلها كـ Strings)
        if (pricingOptions) pricingOptions = JSON.parse(pricingOptions);
        if (curriculum) curriculum = JSON.parse(curriculum);

        // مسار الصورة المحفوظة
        const coverImagePath = req.file ? `/uploads/${req.file.filename}` : null;

        // التحقق من الحقول الأساسية
        if (!title || !description || !category || !curriculum || curriculum.length === 0) {
            return res.status(400).json({ message: 'الرجاء إكمال كافة البيانات المطلوبة' });
        }

        // إنشاء الدورة في قاعدة البيانات
        const newCourse = await Course.create({
            title,
            description,
            level,
            category,
            pricingOptions,
            curriculum,
            coverImage: coverImagePath
        });

        res.status(201).json({ message: 'تم نشر الدورة بنجاح', course: newCourse });

    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({ message: err.message || 'حدث خطأ في السيرفر' });
    }
};
const getEditCourse = async (req, res) => {
    const courseId = req.params.id; 

    try {
        // جلب جميع الأقسام (Categories)
        const categories = await Category.find({})
                                         .select('name _id') // نختار الاسم والمعرّف فقط
                                         .lean();
        // جلب جميع بيانات الدورة، بما في ذلك المنهج الدراسي
        const course = await Course.findById(courseId).lean();

        if (!course) {
            return res.status(404).render('404', { message: 'الدورة غير موجودة.' });
        }

        // ⭐️ إرسال كائن الدورة (course) إلى ملف القالب (edit_course.ejs)
        res.render('dashboard/edit_course', { 
            title: `تعديل الدورة: ${course.title}`,
            course: course ,
            categories: categories
        });

    } catch (err) {
        console.error("خطأ في جلب بيانات الدورة للتعديل:", err);
        res.status(500).render('error', { message: 'فشل في تحميل بيانات الدورة.' });
    }
};

// -----------------------------------------------------
// 4. معالجة تحديث بيانات الدورة (POST /api/courses/edit/:id)
// -----------------------------------------------------
const updateCoursePost = async (req, res) => {
   try {
        const courseId = req.params.id;
        
        // فك تشفير البيانات المرسلة كـ Strings
        let { title, description, level, category, pricingOptions, curriculum } = req.body;
        if (pricingOptions) pricingOptions = JSON.parse(pricingOptions);
        if (curriculum) curriculum = JSON.parse(curriculum);

        // هنا نقوم بالتحديث في قاعدة البيانات (مثال باستخدام Mongoose)
        const updatedData = {
            title,
            description,
            level,
            category,
            pricingOptions,
            curriculum
        };

        // إذا تم رفع صورة جديدة
        if (req.file) {
            updatedData.coverImage = `/uploads/${req.file.filename}`;
        }

        const course = await Course.findByIdAndUpdate(courseId, updatedData, { new: true });

        if (!course) return res.status(404).json({ message: "الدورة غير موجودة" });
        
        res.status(200).json({ message: "تم تحديث الدورة بنجاح", course });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "حدث خطأ أثناء التحديث" });
    }
};

// courseController.js

// ... (الدوال الأخرى)

// -----------------------------------------------------
// 5. دالة حذف دورة محددة (DELETE /api/courses/:id)
// -----------------------------------------------------
const deleteCourse = async (req, res) => {
    const courseId = req.params.id; 

    try {
        // استخدام findByIdAndDelete لحذف الدورة
        const result = await Course.findByIdAndDelete(courseId);

        if (!result) {
            return res.status(404).json({ message: 'الدورة غير موجودة ولا يمكن حذفها.' });
        }

        res.status(200).json({ 
            message: 'تم حذف الدورة بنجاح.', 
            courseId: courseId
        });

    } catch (err) {
        console.error("خطأ في حذف الدورة:", err);
        res.status(500).json({ message: 'فشل في عملية الحذف الداخلي للخادم.' });
    }
};

 const home_website_get = async(req, res) => {
  const courses = await Course.find();  console.log(courses);
  res.render('../views/website/home', { title: 'كورسات الموقع', courses: courses});
}
const allCourses_website_get = async(req, res) => {
  const courses = await Course.find();  console.log(courses);
  res.render('../views/website/course-list', { title: 'كورسات الموقع', courses: courses});
}
 const getCourseDetails = async (req, res) => {
    try {
        const courseId = req.params.id; // استخراج الـ ID من URL

        // 1. البحث عن الكورس في قاعدة البيانات
        // استخدام .lean() لتحسين الأداء عند جلب البيانات للعرض فقط
        const course = await Course.findById(courseId).lean().populate('category');
const courses=await Course.find().lean().populate('category');
        if (!course) {
            // إذا لم يتم العثور على الكورس
            return res.status(404).render('404', { message: 'عذراً، لم يتم العثور على هذا الكورس.' });
        }

        // 2. تحضير بعض البيانات الإضافية إذا لزم الأمر
        // (يمكنك هنا إضافة منطق لحساب التقييمات، أو جلب بيانات المعلم)
        
        // 3. عرض صفحة التفاصيل
        res.render('../views/website/course-details', { 
            course: course,
            title: course.title ,
            user: req.user,
            relatedCourses:courses,
            // لتمرير العنوان إلى <title>
        });

    } catch (error) {
        console.error("Error fetching course details:", error);
        // التعامل مع الأخطاء مثل ID غير صالح
        res.status(500).render('error', { message: 'حدث خطأ أثناء جلب تفاصيل الكورس.' });
    }
};

const checkout = async (req, res) => {
    // 1. استخراج البيانات من جسم الطلب
 
console.log(req.body);
 const { 
        courseId, 
        numberOfSessionsPerMonth, 
        selectedPriceOption, 
        studentId,
        totalAmount, // تم استقبالها بشكل صحيح من الواجهة الأمامية المصححة
       
    } = req.body; 
    console.log(req.body);
    try {
        const request = await Subscription.create({ 
            courseId,
            numberOfSessionsPerMonth,
            selectedPriceOption,
            studentId,
            totalAmount
                // يتم إدراج هيكل المنهج الدراسي مباشرة
            // creator: req.user._id // (إذا كنت تستخدم مصادقة)
        });
console.log(request);
        // 4. إرسال استجابة النجاح (عادةً ما يتم إرسال كائن الدورة الجديدة)
        res.status(200).json({data: request});

    } catch (err) {
        console.error(err);
        // 5. معالجة أخطاء التحقق أو أخطاء قاعدة البيانات
        res.status(400).json({ 
            message: err
        });
    }
};
const getAdminSubscription = async (req, res) => {

try {
        let subscriptions = await Subscription.find()
    .populate({
        path: 'courseId',
        populate: { path: 'category', model: 'Category' }
    })
    .populate('studentId')
    .populate('teacherId')
    .sort({ createdAt: -1 });

// تصفية النتائج لاستبعاد الاشتراكات التي ليس لها طالب (المحذوفين)
subscriptions = subscriptions.filter(sub => sub.studentId !== null);
const now = new Date();
now.setHours(0, 0, 0, 0); // ضبط الوقت للصفر لضمان دقة حساب الأيام

const enhancedSubscriptions = subscriptions.map(sub => {
    const subObj = sub.toObject();
    
    // تأكد من وجود تاريخ بداية وحوله لكائن Date فعلي
    if (sub.startDate) {
        const startDate = new Date(sub.startDate);
        
        // حساب تاريخ النهاية (بعد شهر)
        const endDate = new Date(startDate);
        endDate.setMonth(startDate.getMonth() + 1);
        endDate.setHours(0, 0, 0, 0);

        // الفرق بالأيام: (تاريخ النهاية - تاريخ اليوم) / عدد الملي ثانية في اليوم
        const diffInMs = endDate.getTime() - now.getTime();
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

        subObj.daysRemaining = diffInDays;
        
        // المعيار الأول: هل الأيام المتبقية 2 أو أقل؟
        const timeCritical = diffInDays <= 25 && diffInDays >= 0;

    
        // دمج المعيارين: إذا تحقق أحدهما وكان الاشتراك مؤكداً
        subObj.isCritical = (sub.status === 'confirmed') && (timeCritical );
        console.log(subObj.isCritical,'subObj.isCritical');
    } else {
        subObj.isCritical = false;
    }

    return subObj;
});
        res.render('../views/dashboard/admin_enrollment_management.ejs', { 
            title: 'إدارة الطلبات والاشتراكات',
            bookings: enhancedSubscriptions,
            stats: {
                totalRequests: subscriptions.length,
                pendingRequests: subscriptions.filter(b => b.status === 'pending').length,
              criticalSubscriptions: enhancedSubscriptions.filter(b => b.isCritical === true).length, // إحصائية جديدة
                acceptedRequests: subscriptions.filter(b => b.status === 'confirmed').length,
                rejectedRequests: subscriptions.filter(b => b.status === 'rejected').length
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("خطأ في جلب البيانات");
    }  
}
// مثال لكود Express/Mongoose في متحكم (Controller)
const confirmBookingPayment = async (req, res) => {
  try {
    console.log('BODY:', req.body);

    const bookingId = req.params.id;
    const { startDate, paymentStatus, teacherId, teacherHourlyRate, adminNotes } = req.body;

    // ✅ تحقق من البيانات
    if (!startDate || !paymentStatus  || !teacherId) {
      return res.status(400).json({
        success: false,
        message: 'يرجى تعبئة جميع الحقول'
      });
    }

    // ✅ تجهيز بيانات التحديث
    const updateData = {
      startDate,
      status: paymentStatus,
      teacherId,
      teacherHourlyRate: Number(teacherHourlyRate) || 0,
      adminNotes: adminNotes || ''
    };

    // إضافة تاريخ التأكيد فقط عند التأكيد
    if (paymentStatus === 'confirmed') {
      updateData.confirmedAt = new Date();
    }

    // ✅ التحديث
    const updatedSubscription = await Subscription.findByIdAndUpdate(
      bookingId,
 { $set: updateData }, // استخدام $set لضمان تحديث الحقول المحددة فقط
      { new: true }
    );

    if (!updatedSubscription) {
      return res.status(404).json({
        success: false,
        message: 'الحجز غير موجود'
      });
    }

    // ✅ منطق الإشعارات (اختياري)
    if (paymentStatus === 'confirmed') {
        // تسجيل عملية الدفع
        await Payment.create({
            type: 'income',
            category: 'subscription',
            amount: updatedSubscription.totalAmount, 
            subscriptionId: updatedSubscription._id,
            fromUser: updatedSubscription.studentId, // Ensure populated or just ID is fine
            description: `تسجيل باقة اشتراك جديد`,
            status: 'completed'
        });
    }
    if (paymentStatus === 'confirmed') {
        const userId = updatedSubscription.studentId._id || updatedSubscription.studentId;
        await api_coursesController.notifyUser(userId, {
            title: "تم تسجيل الاشتراك بنجاح! ✅",
            body: "يمكنك الآن البدء فى الدورة التدريبية.",
            data: { screen: "course_details", courseId: updatedSubscription.courseId }
        });
    }
    return res.status(200).json({
      success: true,
      message: 'تم تحديث بيانات الحجز والدفع بنجاح'
    });

  } catch (error) {
    console.error('CONFIRM PAYMENT ERROR:', error);

    return res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تأكيد الدفع'
    });
  }
};


const getManagePayment = async (req, res) => {
    try {
        const booking = await Subscription.findById(req.params.id)
            .populate('studentId') // تأكد من populate للطالب
            .populate('courseId'); // تأكد من populate للكورس
           const teachers = await User.find({ role: 'teacher', status: 'active' }); 
        if (!booking) {
            return res.status(404).render('404'); 
        }

        res.render('dashboard/confirm_payment', { booking: booking , teachers: teachers }); 
        // 💡 تأكد أن اسم ملف EJS هو 'manage_payment.ejs'
        
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

// 1. دالة عرض صفحة الجدولة (GET /booking/:id/schedule)
const getScheduleSessions = async (req, res) => {
    try {
        const bookingId = req.params.id;
        const booking = await Subscription.findById(bookingId)
            .populate('studentId') 
            .populate('courseId').populate('teacherId');
console.log(booking);
        if (!booking) {
            return res.status(404).send('Booking not found.');
        }

        // 💡 تمرير كائن الحجز إلى صفحة EJS
        res.render('dashboard/schedule-sessions', { booking: booking }); 
        
    } catch (error) {
        console.error("Error fetching booking for scheduling:", error);
        res.status(500).send('Server Error');
    }
};

// 2. دالة معالجة الجدولة وتحديثها (POST /booking/:id/update-sessions)
const postUpdateSessions = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { sessions } = req.body;

    if (!Array.isArray(sessions)) {
        return res.status(400).send('Invalid sessions data.');
    }

    // 🔹 جلب الحجز مع بيانات المعلم المسند له الحجز
    // قمنا بإضافة populate لجلب رابط الزووم من ملف المعلم الشخصي
    const booking = await Subscription.findById(bookingId).populate('teacherId', 'zoom_link');
    
    if (!booking || !booking.startDate) {
        return res.status(400).send('Invalid booking or missing start date.');
    }

    // الحصول على رابط المعلم (أو رابط افتراضي إذا لم يوجد)
    const teacherZoomLink = booking.teacherId?.zoom_link || "";

    const courseStartDate = new Date(booking.startDate);
    const maxDateLimit = new Date(courseStartDate);
    maxDateLimit.setDate(maxDateLimit.getDate() + 30); 

    const cleanedSessions = sessions.map((session, index) => {
        const oldSession = booking.sessions[index];

        // 🛑 لو الحصة مكتملة → لا تعديل
        if (oldSession?.status === 'completed') {
            return oldSession;
        }

        if (!session.date || !session.time) {
            throw new Error(`Missing date or time in session ${index + 1}`);
        }

        const sessionDate = new Date(session.date);
        if (sessionDate < courseStartDate || sessionDate > maxDateLimit) {
            throw new Error(`Session ${index + 1} date is outside allowed range`);
        }

        // ✅ بناء كائن الحصة مع إضافة الرابط
        const sessionData = {
            status: session.status || 'pending',
            date: session.date,
            time: session.time,
            utcDateAndTime: convertToUTC(session.date, session.time,req.user.timezone), 
            endtime: session.endtime, // تأكد من استقبال وقت النهاية للتايمر
            link: teacherZoomLink     // 👈 هنا أضفنا رابط المعلم لكل حصة
        };
        console.log(sessionData.date,'sessionData.date');
         console.log(sessionData.time,'sessionData.time');
         console.log(req.user.timezone,'req.user.timezone');
const vvv=convertToUTC(sessionData.date, sessionData.time,req.user.timezone);
console.log(vvv,'vvv');
        // إذا كان هناك ID (تعديل حصة موجودة)
        if (session._id) {
            sessionData._id = session._id;
        }

        return sessionData;
    });

    // 🔹 التحديث النهائي
    await Subscription.findByIdAndUpdate(
        bookingId,
        { sessions: cleanedSessions },
        { runValidators: true }
    );

    return res.redirect('/subscriptions');

} catch (error) {
    console.error('Error updating sessions:', error.message);
    if (error.message.startsWith('Session')) {
        return res.status(400).send(error.message);
    }
    res.status(500).send('Server Error');
}
};


function convertToUTC(date, time, zone) {
  return DateTime
    .fromISO(`${date}T${time}`, { zone })
    .toUTC()
    .toISO();
}



// admin.controller.js

// 1. دالة عرض صفحة إدارة الروابط (GET /booking/:id/manage-sessions)
const getManageSessionsLinks = async (req, res) => {
    try {
        const bookingId = req.params.id;
        // 💡 تأكد من جلب بيانات studentId و courseId و sessions
        const booking = await Subscription.findById(bookingId)
            .populate('studentId') 
            .populate('courseId');

        if (!booking) {
            return res.status(404).send('Booking not found.');
        }

        res.render('dashboard/manage_sessions_links', { booking: booking }); 
        
    } catch (error) {
        console.error("Error fetching booking for link management:", error);
        res.status(500).send('Server Error');
    }
};
// admin.controller.js

// 2. دالة معالجة تحديث الروابط (POST /booking/:id/update-links)
const postUpdateSessionsLinks = async (req, res) => {
    try {
        const bookingId = req.params.id;
        const { sessions } = req.body; 

        // 💡 تحديث الطلب بالمصفوفة الجديدة
        // بما أن الحقول المخفية (date/time) تُرسل أيضاً، سيتم استبدال مصفوفة sessions الحالية
        // وإضافة حقل link لكل عنصر
        await Subscription.findByIdAndUpdate(bookingId, { sessions: sessions }); 
        
        // يمكنك إرسال إشعار للطالب هنا بأن الروابط أصبحت جاهزة

        // التوجيه إلى صفحة إدارة الطلبات بعد التحديث
        res.redirect('/subscriptions'); 
        
    } catch (error) {
        console.error("Error updating session links:", error);
        res.status(500).send('Server Error');
    }
};

const getManageStudents = async (req, res) => {
    try {
       
        // 3. التنفيذ الفعلي لـ find
        const students = await User.find({ role: 'student' })
        
            .select('name email phone_number country_code isActive status createdAt role')
            .sort({ createdAt: -1 });

        res.render('dashboard/students', { 
            students: students,
            user: req.user 
        });
console.log(students[0],'students');
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("حدث خطأ في جلب البيانات");
    }
};
// bookingController.js


// 💡 وظيفة تأكيد انتهاء الجلسة
const markSessionAsComplete = async (req, res, next) => {
    try {
        const { bookingId, sessionId } = req.params;

        // 1. البحث عن الطلب بناءً على الـ ID
        const booking = await Subscription.findById(bookingId);

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found.' });
        }

        // 2. البحث عن الجلسة داخل مصفوفة الجلسات (Sessions Array)
        const sessionToUpdate = booking.sessions.id(sessionId); // طريقة سهلة للبحث في mongoose Array

        if (!sessionToUpdate) {
            return res.status(404).json({ message: 'Session not found in this booking.' });
        }

        // 3. تحديث حالة الجلسة
        sessionToUpdate.status = 'completed'; 
        
        // 4. حفظ التغييرات في قاعدة البيانات
        await booking.save();

        // 5. إعادة التوجيه إلى صفحة الجدولة نفسها لتحديث الواجهة
        res.redirect(`/booking/${bookingId}/schedule`); // افترض أن هذا هو المسار الحالي للصفحة

    } catch (error) {
        console.error('Error marking session as complete:', error);
        req.flash('error', 'حدث خطأ أثناء تأكيد انتهاء الجلسة.');
        next(error);
    }
};
 const adminReportPage = async(req, res) => {
    try {
        // استخراج فلاتر البحث من Query Parameters
        const { month, type } = req.query;
        
        // 1. إجمالي الإيرادات (Income)
        const incomeAgg = await Payment.aggregate([
            { $match: { type: 'income', status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalIncome = incomeAgg[0]?.total || 0;

        // 2. إجمالي المصروفات (Expenses - رواتب المعلمين)
        const expenseAgg = await Payment.aggregate([
            { $match: { 
                $or: [
                    { type: 'expense' },
                    { teacherId: { $exists: true }, type: { $exists: false } }, // السجلات القديمة
                    { status: 'paid' } // السجلات القديمة كان حالتها paid
                ]
            } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalExpenses = expenseAgg[0]?.total || 0;

        // 3. صافي الأرباح
        const netProfit = totalIncome - totalExpenses;

        // 4. مستحقات المعلمين المعلقة (حصص مكتملة ولم تدفع بعد)
        const pendingTeacherDues = await Subscription.aggregate([
            { $unwind: '$sessions' },
            { $match: { 'sessions.status': 'completed', 'sessions.isPaidByAdmin': { $ne: true } } },
            { $lookup: { from: 'users', localField: 'teacherId', foreignField: '_id', as: 'teacher' } },
            { $unwind: '$teacher' },
            { $group: {
                _id: null,
                total: { $sum: { 
                    $multiply: [
                        { $divide: [{ $toDouble: "$selectedPriceOption" }, 60] }, 
                        { $ifNull: ["$teacherHourlyRate", { $ifNull: ["$teacher.hour_rate", 0] }] }
                    ] 
                }}
            }}
        ]);
        const pendingExpenses = pendingTeacherDues[0]?.total || 0;

        // 5. بناء فلتر المعاملات
        let transactionFilter = {};
        
        // فلتر النوع (income / expense)
        if (type && (type === 'income' || type === 'expense')) {
            transactionFilter.type = type;
        }
        
        // فلتر الشهر (format: 2026-02)
        if (month) {
            const [year, monthNum] = month.split('-').map(Number);
            if (year && monthNum) {
                const startDate = new Date(year, monthNum - 1, 1);
                const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);
                transactionFilter.createdAt = { $gte: startDate, $lte: endDate };
            }
        }

        // 6. جلب المعاملات مع الفلاتر
        const transactions = await Payment.find(transactionFilter)
            .sort({ createdAt: -1 })
            .limit(50)
            .populate('fromUser', 'name')
            .populate('toUser', 'name')
            .populate('teacherId', 'name')
            .lean();

        // 7. جلب قائمة الأشهر المتاحة للفلترة
        const availableMonths = await Payment.aggregate([
            { $group: { 
                _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }
            }},
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 12 }
        ]);

        res.render('../views/dashboard/reports', { 
            title: 'التقارير المالية',
            stats: {
                totalIncome: totalIncome.toFixed(2),
                totalExpenses: totalExpenses.toFixed(2),
                netProfit: netProfit.toFixed(2),
                pendingExpenses: pendingExpenses.toFixed(2)
            },
            transactions,
            availableMonths,
            filters: {
                month: month || '',
                type: type || ''
            },
            user: req.user
        });
    } catch (err) {
        console.error("Error in adminReportPage:", err);
        res.status(500).send("خطأ في تحميل التقارير المالية");
    }
}


// controllers/adminController.js
 // افترضنا أن اسم الموديل User

const adminTeachersPage = async (req, res) => {
    try {
        // جلب المستخدمين الذين لديهم رتبة معلم فقط
        const teachers = await User.find({ role: 'teacher' })
                                   .sort({ createdAt: -1 });
res.render('../views/dashboard/teachers', {
            teachers: teachers,
            user: req.user // بيانات الأدمن الحالي (للسيدبار)
        });
        // رندر الصفحة وإرسال البيانات
     
    } catch (err) {
        console.error("Error fetching teachers:", err);
        res.status(500).render('error', { message: "حدث خطأ أثناء جلب بيانات المعلمين" });
    }
};
// ... (بقية وظائف المتحكم) ...
const updateTeacher = async (req, res) => {
    try {
        const teacherId = req.params.id;
        const updates = {
            name: req.body.name,
            zoom_link: req.body.zoom_link,
            phone_number: req.body.phone_number,
            notes: req.body.notes,
            hourly_rates: req.body.hourly_rates
        };

        // تحديث المستخدم في قاعدة البيانات
        const updatedUser = await User.findByIdAndUpdate(teacherId, updates, { new: true });
console.log(updatedUser);
        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'المعلم غير موجود' });
        }

        res.json({ success: true, message: 'تم تحديث البيانات بنجاح' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'خطأ داخلي في السيرفر' });
    }
};
// تأكد من مسار موديل المستخدم

// إضافة معلم جديد
const addTeacher = async (req, res) => {
    try {
        const { name, phone_number, zoom_link, hour_rate, notes, email } = req.body;
        const defaultPassword = 'password123';

        // 1. التحقق من عدم وجود حساب بنفس الإيميل (اختياري لكن مهم)
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'البريد الإلكتروني مستخدم بالفعل' });
        }

        // 3. تشفير كلمة المرور
        // 2. إنشاء كائن المعلم الجديد مع تحديد الرتبة
        const newTeacher = new User({
            name,
            phone_number,
            zoom_link,
            hourly_rates: req.body.hourly_rates,
            notes,
            email,
            password: defaultPassword,
            role: 'teacher',
            status: 'active'
        });

        // 3. حفظ في قاعدة البيانات
        await newTeacher.save();

        res.status(201).json({ 
            success: true, 
            message: 'تم إضافة المعلم بنجاح' 
        });

    } catch (error) {
        console.error("Error adding teacher:", error);
        res.status(500).json({ 
            success: false, 
            message: 'حدث خطأ أثناء حفظ البيانات' 
        });
    }
};

// تعديل معلم موجود



const checkConflict = async (req, res) => {
    try {
        const { teacherId, date, time, bookingId } = req.body;
        
        // 1. تحويل الوقت الجديد إلى دقائق (مثلاً 18:30 تصبح 1110 دقيقة)
        const [hours, minutes] = time.split(':').map(Number);
        const newStartTotal = hours * 60 + minutes;
        const sessionDuration = 60; // مدة الحصة بالدقائق
        const newEndTotal = newStartTotal + sessionDuration;

        // 2. جلب جميع حجوزات هذا المعلم في هذا التاريخ تحديداً
        const targetDate = new Date(date);
        const startOfDay = new Date(targetDate.setHours(0,0,0,0));
        const endOfDay = new Date(targetDate.setHours(23,59,59,999));

        const bookings = await Subscription.find({
            teacherId: teacherId,
            _id: { $ne: bookingId }, // استثناء الحجز الحالي
            "sessions.date": { $gte: startOfDay, $lte: endOfDay }
        });

        // 3. فحص التداخل يدوياً لضمان الدقة
        let hasConflict = false;
        
        for (const booking of bookings) {
            for (const session of booking.sessions) {
                // فحص الحصص التي في نفس اليوم وليست ملغاة
                if (session.date.toDateString() === startOfDay.toDateString() && session.status !== 'missed') {
                    
                    const [sHours, sMinutes] = session.time.split(':').map(Number);
                    const existStart = sHours * 60 + sMinutes;
                    const existEnd = existStart + sessionDuration;

                    // معادلة التداخل: (البداية الجديدة < نهاية القديمة) و (النهاية الجديدة > بداية القديمة)
                    if (newStartTotal < existEnd && newEndTotal > existStart) {
                        hasConflict = true;
                        break;
                    }
                }
            }
            if (hasConflict) break;
        }

        if (hasConflict) {
            return res.json({ conflict: true, message: "⚠️ تعارض زمني: يوجد حصة أخرى في هذا الوقت" });
        }

        res.json({ conflict: false });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

const getDashboardStats=  async () => {
    console.log("getDashboardStats");
    try {
        // تنفيذ جميع الاستعلامات في وقت واحد لتحسين الأداء
        const [
            totalStudents,
            totalTeachers,
            activeCourses,
            revenueData,
            popularCourses,
            recentSubscriptions
        ] = await Promise.all([
            User.countDocuments({ role: 'student' }),
            User.countDocuments({ role: 'teacher' }),
            Course.countDocuments(),
            Subscription.aggregate([{ $group: { _id: null, total: { $sum: "$totalAmount" } } }]), // استخدم totalAmount بدلاً من amount
            Course.find().sort({ studentsCount: -1 }).limit(5), 
            Subscription.find()
                .sort({ createdAt: -1 })
                .limit(6)
                .populate('studentId', 'name')
                .populate('courseId', 'title')
        ]);

        return {
            summary: {
                students: totalStudents,
                teachers: totalTeachers,
                courses: activeCourses,
                revenue: revenueData[0]?.total || 0
            },
            popularCourses,
            recentRegistrations: recentSubscriptions
        };
    } catch (error) {
        console.log(error);
    return {
        summary: { students: 0, teachers: 0, courses: 0, revenue: 0 },
        popularCourses: [],
        recentRegistrations: []
    };
    }
}



const getUpcomingSessions = async (req, res) => {
    try {
        // Default Filtering: Today
        // Using request query params if available, otherwise default to today
        let startDate = req.query.from ? DateTime.fromISO(req.query.from).startOf('day') : DateTime.now().startOf('day');
        let endDate = req.query.to ? DateTime.fromISO(req.query.to).endOf('day') : DateTime.now().endOf('day');

        // Check validity, if invalid fallback to today
        if (!startDate.isValid) startDate = DateTime.now().startOf('day');
        if (!endDate.isValid) endDate = DateTime.now().endOf('day');

        const subscriptions = await Subscription.find({ 
            status: 'confirmed',
            'sessions.0': { $exists: true } 
        })
        .populate({ path: 'studentId', select: 'name email devices phone_number' })
        .populate({ path: 'teacherId', select: 'name' })
        .populate({ path: 'courseId', select: 'title' });

        let upcomingSessions = [];

        subscriptions.forEach(sub => {
            if (!sub.sessions) return;
            sub.sessions.forEach(session => {
                if (!session.utcDateAndTime) return;

                const sessionTime = DateTime.fromISO(session.utcDateAndTime);
                
                // Compare with Filter Range (Inclusive)
                if (sessionTime >= startDate && sessionTime <= endDate && session.status !== 'completed' && session.status !== 'missed') {
                    
                    // Filter out unknown students
                    if (!sub.studentId) return;

                    upcomingSessions.push({
                         sessionId: session._id,
                         subscriptionId: sub._id,
                         studentName: sub.studentId.name || 'طالب بدون اسم', // Fallback just in case name is empty but object exists
                         studentId: sub.studentId._id,
                         courseTitle: sub.courseId ? sub.courseId.title : 'دورة غير معروفة',
                         teacherName: sub.teacherId ? sub.teacherId.name : 'معلم غير محدد',
                         date: session.date, 
                         time: session.time,
                         displayDate: sessionTime.setZone('Asia/Riyadh').toFormat('yyyy-MM-dd'),
                         displayTime: sessionTime.setZone('Asia/Riyadh').toFormat('hh:mm a'),
                         utcDate: session.utcDateAndTime,
                         link: session.link
                    });
                }
            });
        });

        // Sort by date (nearest first)
        upcomingSessions.sort((a, b) => DateTime.fromISO(a.utcDate) - DateTime.fromISO(b.utcDate));

        res.render('dashboard/upcoming_sessions', { 
            title: 'الجلسات القادمة وإرسال الإشعارات',
            sessions: upcomingSessions,
            user: req.user,
            filters: {
                from: startDate.toFormat('yyyy-MM-dd'),
                to: endDate.toFormat('yyyy-MM-dd')
            }
        });

    } catch (error) {
        console.error("Error fetching upcoming sessions:", error);
        res.status(500).send("Server Error");
    }
};


const sendSessionNotification = async (req, res) => {
    try {
        const { title, body, sessionIds } = req.body;
        
        if (!title || !body) {
            return res.status(400).json({ success: false, message: "Title and body are required" });
        }

        let userIdsToNotify = new Set();
        let targetSessions = [];

        if (sessionIds && Array.isArray(sessionIds) && sessionIds.length > 0) {
             targetSessions = sessionIds;
        } 

        if (targetSessions.length > 0) {
             const subscriptions = await Subscription.find({
                 'sessions._id': { $in: targetSessions }
             }).populate('studentId');
             
             subscriptions.forEach(sub => {
                 if (sub.studentId && sub.studentId._id) {
                     userIdsToNotify.add(sub.studentId._id.toString());
                 }
             });
        }

        console.log(`Sending notification to ${userIdsToNotify.size} unique users`);
        
        if (userIdsToNotify.size === 0) {
             return res.json({ success: true, count: 0, message: "No users found or no sessions selected" });
        }

        const notifications = [];
        for (const userId of userIdsToNotify) {
            notifications.push(api_coursesController.notifyUser(userId, {
                title,
                body,
                data: { screen: 'sessions' }
            }));
        }
        
        await Promise.all(notifications);

        res.json({ success: true, count: userIdsToNotify.size });

    } catch (error) {
        console.error("Notification Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getDashboardStats,
    checkConflict,
    adminReportPage,getAdminDashboard,getAdminSubscription,addTeacher,
    getAddCourse,adminTeachersPage,updateTeacher,
    addCourse,
    getAllCourses,
    getEditCourse,
    updateCoursePost,getManagePayment,
    deleteCourse,
    home_website_get,
    allCourses_website_get,
    getCourseDetails,checkout,confirmBookingPayment,
    getScheduleSessions,
    postUpdateSessions,
    getManageSessionsLinks,
    postUpdateSessionsLinks,getManageStudents,markSessionAsComplete,
    getUpcomingSessions,
    sendSessionNotification
};
