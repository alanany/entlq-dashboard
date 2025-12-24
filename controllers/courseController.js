// في courseController.js
// GET - Show All Courses
const Category = require('../models/category_model.js');
const Course = require('../models/course_model.js');
const User = require('../models/user_model.js');
const Subscription= require('../models/subscription_model.js');
const bcrypt = require('bcryptjs');
const getAdminDashboard = async (req, res) => {
    
    // 'dashboard/index' هو المسار النسبي للملف داخل مجلد 'views'
    res.render('dashboard/index', { title: 'لوحة تحكم الأدمن' }); };
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


 // تأكد من المسار الصحيح لنموذج الدورة

// 💡 دالة معالجة إرسال النموذج (POST) لإضافة دورة جديدة
const addCourse = async (req, res) => {
    // 1. استخراج البيانات من جسم الطلب
    const { 
        title, 
        description, 
        level, 
        category,
        pricingOptions, // تم استقبالها بشكل صحيح من الواجهة الأمامية المصححة
        curriculum 
    } = req.body; 
console.log(req.body);
    // 2. التحقق الأساسي من الحقول الضرورية
    // ⭐️ التصحيح: تم تغيير 'lengrh' إلى 'length' ⭐️
    if (!title || !description || !level || !category || curriculum.length === 0 || pricingOptions.length === 0) {
        return res.status(400).json({ 
            message: 'الرجاء تعبئة جميع الحقول الأساسية وخيارات التسعير وحقول المنهج الدراسي.' 
        });
    }

    // 3. إنشاء كائن الدورة في قاعدة البيانات
    try {
        const course = await Course.create({ 
            title, 
            description, 
            level, 
            category,
            pricingOptions, // ⬅️ إضافة حقل التسعير المفقود
            curriculum,     // يتم إدراج هيكل المنهج الدراسي مباشرة
            // creator: req.user._id // (إذا كنت تستخدم مصادقة)
        });

        // 4. إرسال استجابة النجاح (عادةً ما يتم إرسال كائن الدورة الجديدة)
        res.status(201).json();

    } catch (err) {
        // 5. معالجة أخطاء التحقق أو أخطاء قاعدة البيانات
        console.error("خطأ في إنشاء الدورة:", err);
        
        let errorMessage = 'فشل في إنشاء الدورة. يرجى التحقق من المدخلات.';
        
        if (err.name === 'ValidationError') {
             // جمع رسائل التحقق من Mongoose
            errorMessage = "خطأ في التحقق من البيانات: " + Object.values(err.errors).map(val => val.message).join(', ');
        } else if (err.code && err.code === 11000) {
             // معالجة خطأ تكرار المفتاح الفريد
             errorMessage = "هذا العنوان (Title) مستخدم بالفعل. يرجى اختيار عنوان آخر.";
        }

        res.status(400).json({ 
            message: errorMessage
        });
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
    const courseId = req.params.id;
    
    // 💡 التعديل: نستقبل pricingOptions بدلاً من price
    const { 
        title, 
        description, 
        // ⭐️⭐️ تم تغيير price إلى pricingOptions ⭐️⭐️
        pricingOptions, 
        level, 
        category, 
        curriculum 
    } = req.body; 

    const updates = {
        title, 
        description, 
        // ⭐️⭐️ تمرير pricingOptions ⭐️⭐️
        pricingOptions, 
        level, 
        category, 
        curriculum
        // يمكنك هنا إضافة حقل coverImageURL إذا تم رفع صورة جديدة
    };
    console.log(updates);
    try {
        
        const updatedCourse = await Course.findByIdAndUpdate(
            courseId, 
            updates, 
            { new: true, runValidators: true } // new: true لإرجاع المستند المحدث
        );

        if (!updatedCourse) {
            return res.status(404).json({ message: 'الدورة غير موجودة.' });
        }

        res.status(200).json({ 
            message: 'تم تحديث الدورة بنجاح.', 
            courseId: updatedCourse._id 
        });

    } catch (err) {
        console.error("خطأ في تحديث الدورة:", err);
        
        let errorMessage = 'فشل في تحديث الدورة.';
        if (err.name === 'ValidationError') {
            // معالجة أخطاء التحقق من الصحة (Schema Validation)
            errorMessage = Object.values(err.errors).map(val => val.message).join(', ');
        }
        
        res.status(400).json({ message: errorMessage });
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
            user: req.user
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
        const subscriptions = await Subscription.find()
            .populate({
                path: 'courseId',
                populate: { path: 'category', model: 'Category' }
            })
            .populate('studentId')
            .populate('teacherId') // أضفنا المعلم أيضاً
            .sort({ createdAt: -1 });

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
    const { startDate, paymentStatus, teacherId } = req.body;

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
      teacherId
    };

    // إضافة تاريخ التأكيد فقط عند التأكيد
    if (paymentStatus === 'confirmed') {
      updateData.confirmedAt = new Date();
      updateData.sessions = [];
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
      // sendNotificationToStudent(...)
    }

    return res.status(200).json({
      success: true,
      message: 'تم تأكيد الدفع بنجاح'
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
            endtime: session.endtime, // تأكد من استقبال وقت النهاية للتايمر
            link: teacherZoomLink     // 👈 هنا أضفنا رابط المعلم لكل حصة
        };

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
        const { search } = req.query;
        let studentsQuery = {};

        // منطق البحث
        if (search) {
            const regex = new RegExp(search, 'i'); // i for case-insensitive
            studentsQuery = {
                $or: [
                    { name: { $regex: regex } },
                    { email: { $regex: regex } }
                ]
            };
        }

        // جلب الطلاب
        const students = await User.find(studentsQuery).lean();
        
        // (خطوة اختيارية): إضافة عدد الدورات لكل طالب
        const studentsWithDetails = await Promise.all(students.map(async (student) => {
            // يمكنك استخدام نموذج حجز Course.countDocuments({ student: student._id }) إذا كان لديك حقل مرجع
            const coursesCount = await Subscription.countDocuments({ studentId: student._id, status: 'confirmed' });
            return {
                ...student,
                coursesCount: coursesCount
            };
        }));
        
        res.render('dashboard/students', { 
            students: studentsWithDetails,
            searchTerm: search || ''
        });

    } catch (error) {
        console.error("Error fetching students:", error);
        res.render('admin/manage_students', { 
            students: [],
            error: 'حدث خطأ أثناء جلب بيانات الطلاب.'
        });
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
  res.render('../views/dashboard/reports', { title: 'التقارير الموقع'});
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
            hour_rate: req.body.hour_rate
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
            hour_rate,
            notes,
            email,      // إذا كنت ستضيف إيميل في الفورم
            password: defaultPassword,   // يفضل وضع كلمة مرور افتراضية أو استقبالها
            role: 'teacher', // تعيين الرتبة تلقائياً
            status: 'active' // الحالة الافتراضية
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
};
module.exports = {checkConflict,
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
  
};