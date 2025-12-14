// في courseController.js
// GET - Show All Courses
const Category = require('../models/category_model.js');
const Course = require('../models/course_model.js');
const User = require('../models/user_model.js');
const Subscription= require('../models/subscription_model.js');
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

 const subscription = await Subscription.find().populate({
                path: 'courseId', // قم بتعبئة الكورس أولاً
                // داخل الكورس المُعبَّأ، قم بتعبئة التصنيف
                populate: {
                    path: 'category', // اسم الحقل في موديل Course
                    model: 'Category' // اسم موديل التصنيف
                }
            })
            .populate('studentId').sort({ createdAt: -1 });

console.log("Bookings:", subscription);

    // 'dashboard/index' هو المسار النسبي للملف داخل مجلد 'views'
    res.render('../views/dashboard/admin_enrollment_management.ejs', { title: 'طلباتى ',
       bookings:subscription,
        stats: {
            totalRequests: subscription.length,
            pendingRequests: subscription.filter(b => b.status === 'pending').length,
            acceptedRequests: subscription.filter(b => b.status === 'confirmed').length,
            awaitingPayment: subscription.filter(b => b.status === 'awaiting_payment').length,
            rejectedRequests: subscription.filter(b => b.status === 'rejected').length
        }
}
);    
}
// مثال لكود Express/Mongoose في متحكم (Controller)
const confirmBookingPayment = async (req, res) => {
    try {
        const bookingId = req.params.id;
        const { startDate, paymentStatus, adminNotes } = req.body;

        const updateData = {
            startDate: startDate,
            status: paymentStatus,
            adminNotes: adminNotes,
            // إذا كان مؤكد، يمكنك إضافة تاريخ التأكيد هنا
            confirmedAt: paymentStatus === 'confirmed' ? new Date() : undefined 
        };

        await Subscription.findByIdAndUpdate(bookingId, updateData, { new: true });
        
        // إرسال إشعار للطالب إذا تم التأكيد
        if (paymentStatus === 'confirmed') {
             // ... منطق إرسال رسالة أو إشعار للطالب بأن حجزه قد تم تأكيده وتاريخ البدء
        }

        res.redirect('/subscriptions'); // العودة إلى صفحة الطلبات الرئيسية
    } catch (error) {
        // ... التعامل مع الأخطاء
    }
};

const getManagePayment = async (req, res) => {
    try {
        const booking = await Subscription.findById(req.params.id)
            .populate('studentId') // تأكد من populate للطالب
            .populate('courseId'); // تأكد من populate للكورس
            
        if (!booking) {
            return res.status(404).render('404'); 
        }

        res.render('dashboard/confirm_payment', { booking: booking }); 
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
            .populate('courseId');
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

        // 🔹 جلب الحجز الحالي
        const booking = await Subscription.findById(bookingId);
        if (!booking || !booking.startDate) {
            return res.status(400).send('Invalid booking or missing start date.');
        }

        const courseStartDate = new Date(booking.startDate);
        const maxDateLimit = new Date(courseStartDate);
        maxDateLimit.setDate(maxDateLimit.getDate() + 30); // شهر واحد

        // 🔹 تنظيف + حماية + Validation
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
                throw new Error(
                    `Session ${index + 1} date is outside allowed range`
                );
            }

            // ✅ أول مرة → بدون _id
            if (!session._id) {
                return {
                    status: session.status || 'pending',
                    date: session.date,
                    time: session.time
                };
            }

            // ✅ تعديل جلسة موجودة
            return {
                _id: session._id,
                status: session.status || 'pending',
                date: session.date,
                time: session.time
            };
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
// ... (بقية وظائف المتحكم) ...
module.exports = {
    adminReportPage,getAdminDashboard,getAdminSubscription,
    getAddCourse,
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
    postUpdateSessionsLinks,getManageStudents,markSessionAsComplete
};