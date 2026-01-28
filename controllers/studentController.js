const User = require("../models/user_model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Course = require("../models/course_model.js");
const Subscription = require("../models/subscription_model.js");
const teacherController = require("../controllers/teacher_controller");
const courseController=require("../controllers/courseController");
const getstudentDashboard = async (req, res, next) => {
  try {
    const role = req.user.role;
    // c على أقرب حصة
    if (role === "student") {
      const studentId = req.user._id;
      const nearestSession = await getNearestSession(studentId, req.user.timezone);
            
     
        
     const studentStats =   await     getStudentStats(studentId);
     const courseBookingDetails=await getStudentCourseDetails(studentId);
            console.log(courseBookingDetails, "courseBookingDetails in controller");

      res.render("dashboard/student/student-dashboard", {
        title: "لوحة تحكم الطالب",
        nearestSession,
        studentStats,
        courseBookingDetails,
        user: req.user
      });
    } else if (role === "teacher") {
    await  teacherController.teacherHome(req, res, next);
    } else {
     
     console.log("admin dashboard");
      const stats = await courseController.getDashboardStats();
      console.log(stats,'stats'); 
      // For non-students, render without student data
      res.render("../views/dashboard/index", {
        title: "Dashboard",
        user: req.user,
        stats:stats
      });
    }
  } catch (error) {
      res.render("website/home");
    console.error("Error loading dashboard:", error);
    res
      .status(500)
      .render("error", { message: "حدث خطأ أثناء تحميل لوحة التحكم." });
  }
  // 'dashboard/index' هو المسار النسبي للملف داخل مجلد 'views'
};
const getSucessSubscriptionPage = async (req, res) => {
  // 'dashboard/index' هو المسار النسبي للملف داخل مجلد 'views'
  res.render("dashboard/student/subscribe-confirm", {
    title: "  نجاح الاشتراك",
  });
};

const signup_get = (req, res) => {
  res.render("../views/dashboard/student/register");
};

const login_get = (req, res) => {
   res.render("../views/dashboard/student/login");
};




// إضافة طالب جديد (الحقول الـ 8)
const addStudent = async (req, res) => {
    try {
        const { name, email, country_code, phone_number, gender, password, timezone } = req.body;
        
        const existingStudent = await User.findOne({ email });
        if (existingStudent) {
            return res.status(400).json({ success: false, message: 'البريد الإلكتروني مسجل مسبقاً' });
        }

        const newStudent = new User({
            name, email, country_code, phone_number,
            gender, password, timezone,
            status: 'active'
        });

        await newStudent.save();
        // الرد بـ JSON وليس Redirect
        res.status(200).json({ success: true, message: 'تم تسجيل الطالب بنجاح' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'حدث خطأ أثناء التسجيل' });
    }
};

// تبديل الحالة (أرشفة / تنشيط)
const toggleStatus = async (req, res) => {
 try {
    const { studentId, isActive } = req.body;
    console.log(studentId, isActive, "بيانات التحديث");

    // تحديث الحالة في موديل المستخدم
    await User.findByIdAndUpdate(studentId, { isActive: isActive });

    res.json({
      success: true,
      message: isActive
        ? "تم تفعيل حساب الطالب بنجاح"
        : "تم نقل الطالب للأرشيف بنجاح",
    });
  } catch (error) {
    console.error("Error in updateTeacherStatus:", error);
    res
      .status(500)
      .json({ success: false, error: "حدث خطأ في السيرفر أثناء تحديث الحالة" });
  }
};

// حذف الطالب
const deleteStudent = async (req, res) => {
  console.log(req.params.id,'req.params.id');
    try {
        await User.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: 'تم الحذف بنجاح' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'حدث خطأ أثناء الحذف' });
    }
};


const registerStudent = async (req, res) => {
  // استخراج البيانات من جسم الطلب
  const {
    name,
    email,
    country_code,
    phone_number,
    gender,
    password,
    confirm_Password,
    timezone,
  } = req.body;

  try {
    // التحقق من الحقول المطلوبة
    const requiredFields = {
      name: "الاسم",
      email: "البريد الإلكتروني",
      phone_number: "رقم الجوال",
      gender: "النوع",
      password: "كلمة المرور",
      confirm_Password: "تأكيد كلمة المرور",
      timezone: "المنطقة الزمنية",
    };

    const missingFields = [];
    for (const [field, label] of Object.entries(requiredFields)) {
      if (!req.body[field] || req.body[field].trim() === "") {
        missingFields.push(label);
      }
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `الحقول التالية مطلوبة: ${missingFields.join(", ")}`,
        errors: {
          general: `الحقول التالية مطلوبة: ${missingFields.join(", ")}`,
        },
      });
    }

    // التحقق من وجود مستخدم بنفس البريد الإلكتروني
    const existingStudent = await User.findOne({ email });
    if (existingStudent) {
      console.log("Email already exists");
      return res.status(400).json({
        error: "هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول.",
        errors: {
          email: "هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول.",
        },
      });
    }

    // التحقق من تطابق كلمات المرور (يتم يدوياً قبل محاولة الحفظ)
    if (password !== confirm_Password) {
      return res.status(400).json({
        error: "كلمتا المرور غير متطابقتين. يرجى التأكد من الإدخال.",
        errors: {
          password: "كلمتا المرور غير متطابقتين. يرجى التأكد من الإدخال.",
        },
      });
    }
    // إنشاء طالب جديد

    const user = await User.create({
      name,
      email,
      country_code: country_code,
      phone_number: country_code + phone_number, // حفظ رقم الهاتف بالكامل
      gender,
      password,
      timezone,
      role: "student",
    });
    console.log(user);
    // حفظ الطالب في قاعدة البيانات (سيتم تشفير كلمة المرور تلقائيًا عبر الـ middleware)

    res.status(200).json({
      message: "تم التسجيل بنجاح.", // تمرير الرسالة المجمعة
    });
    // إعادة توجيه المستخدم إلى صفحة تسجيل الدخول أو صفحة النجاح
    // يمكن أيضًا إنشاء جلسة (Session) هنا لتسجيل الدخول الفوري
  } catch (err) {
    console.log(err, "err");

    let errorMessage = "حدث خطأ غير متوقع أثناء التسجيل.";
    let errors = {};

    // 🟢 الخطوة الحاسمة: تحليل خطأ Mongoose Validation
    if (err.name === "ValidationError") {
      // تجميع رسائل الأخطاء حسب الحقل
      Object.keys(err.errors).forEach((key) => {
        errors[key] = err.errors[key].message;
      });

      // إنشاء رسالة عامة من جميع الأخطاء
      const validationMessages = Object.values(errors);
      errorMessage = validationMessages.join(" | ");
    } else if (err.code === 11000) {
      // خطأ تكرار (Duplicate Key Error)
      const duplicateField = Object.keys(err.keyPattern)[0];
      if (duplicateField === "email") {
        errorMessage = "هذا البريد الإلكتروني مسجل بالفعل.";
        errors.email = "هذا البريد الإلكتروني مسجل بالفعل.";
      } else {
        errorMessage = `هذا ${duplicateField} مسجل بالفعل.`;
        errors[duplicateField] = `هذا ${duplicateField} مسجل بالفعل.`;
      }
    }

    // 📢 عرض الخطأ في الفرونت-إند مع دعم الأخطاء المحددة حسب الحقل
    res.status(400).json({
      error: errorMessage,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      message: errorMessage, // للتوافق مع الأنماط الأخرى
    });
  }
};







const maxAge = 3 * 24 * 60 * 60;
const createToken = (id) => {
  return jwt.sign({ id }, "01115699209", {
    expiresIn: maxAge,
  });
};
const update_profile = async (req, res) => {
    try {
        const { name } = req.body;
        await User.findByIdAndUpdate(req.user._id, { name },{ new: true, runValidators: true });
res.status(200).json({ message: "تم تحديث الملف الشخصي بنجاح." });
       
        
    } catch (err) {
      console.log(err);
        res.redirect('/settings?error=profile');
    }
};
const login_student = async (req, res) => {
  // 1. استخراج البيانات المطلوبة
  const { email, password, role,timezone} = req.body;
console.log(timezone,'timezone');
  // **كائن الأخطاء المخصص**
  let errors = {};

  try {
    // 2. البحث عن المستخدم بالبريد والدور
    const user = await User.findOne({ email: email, role: role });

    if (!user) {
      // 3. حالة: المستخدم غير موجود (البريد غير صحيح)
      errors.email = "هذا البريد الإلكتروني غير صحيح";
      res.status(400).json({ errors });
      return; // ⭐️ إيقاف التنفيذ بعد إرسال الاستجابة
    }

    // 4. إذا تم العثور على المستخدم، مقارنة كلمة المرور
    const auth = await bcrypt.compare(password, user.password);

    if (!auth) {
      // 5. حالة: كلمة المرور غير صحيحة
      errors.password = "كلمة المرور المدخلة غير صحيحة";
      res.status(400).json({ errors });
      return; // ⭐️ إيقاف التنفيذ بعد إرسال الاستجابة
    }

 if (timezone && user.timezone !== timezone) {
    user.timezone = timezone;
    await user.save();
    console.log(`تم تحديث توقيت المستخدم إلى: ${timezone}`);
}
     // 6. حالة النجاح: كلمة المرور صحيحة
    const token = createToken(user._id);
    await res.cookie("jwt", token, { httpOnly: true, maxAge: maxAge * 1000 });

    // إرسال استجابة النجاح
    res.status(200).json({ user: user._id, message: "تم تسجيل الدخول بنجاح." });
    return; // ⭐️ إيقاف التنفيذ بعد إرسال الاستجابة
  } catch (err) {
    // 7. التقاط أخطاء الخادم العامة أو أخطاء قاعدة البيانات
    console.error(err);

    // استخدام دالة handleErrors لمعالجة الأخطاء غير المتوقعة (مثل خطأ في الخادم)
    const specificErrors = handleErrors(err);
    res.status(400).json({ errors: specificErrors });
    return; // ⭐️ إيقاف التنفيذ
  }
};
const getAllCourses = async (req, res) => {
  const courses = await Course.find();
  console.log(courses);
  // 'dashboard/index' هو المسار النسبي للملف داخل مجلد 'views'
  res.render("../views/dashboard/student/course-list", {
    title: "كورسات الموقع",
    courses: courses,
  });
};
const getAllCoursesForAdminAutoSubscription = async (req, res) => {
  const courses = await Course.find();
  console.log(courses);
  // 'dashboard/index' هو المسار النسبي للملف داخل مجلد 'views'
  res.render("../views/dashboard/student/course-list", {
    title: "كورسات الموقع",
    courses: courses,
    studentId: req.params.studentId,
  });
};
const getBookPlan = async (req, res) => {
  const courseId = req.params.id;

  try {
    const course = await Course.findById(courseId).populate("category");
    console.log(course);
    if (!course) {
      return res.status(404).render("404", { message: "الدورة غير موجودة." });
    }

    // ⭐️ إرسال كائن الدورة (course) إلى ملف القالب (edit_course.ejs)
    res.render("../views/dashboard/student/book-plan", {
      title: `حجز الدورة:`,
      course: course,
    });
  } catch (err) {
    console.error("خطأ في جلب بيانات الدورة للتعديل:", err);
    res.status(500).render("error", { message: "فشل في تحميل بيانات الدورة." });
  }
};
const getAutoAdminBookPlan = async (req, res) => {
  const courseId = req.params.id;
  const studentId = req.params.studentId;
  console.log(studentId,'studentId');

  try {
    const course = await Course.findById(courseId).populate("category");
    console.log(course);
    if (!course) {
      return res.status(404).render("404", { message: "الدورة غير موجودة." });
    }

    // ⭐️ إرسال كائن الدورة (course) إلى ملف القالب (edit_course.ejs)
    res.render("../views/dashboard/student/book-plan", {
      title: `حجز الدورة:`,
      course: course,
      studentId: studentId,
    });
  } catch (err) {
    console.error("خطأ في جلب بيانات الدورة للتعديل:", err);
    res.status(500).render("error", { message: "فشل في تحميل بيانات الدورة." });
  }
};
const getEnrolledSubscription = async (req, res) => {
  const subscription = await Subscription.find({ studentId: req.user._id })
    .populate({
      path: "courseId", // قم بتعبئة الكورس أولاً
      // داخل الكورس المُعبَّأ، قم بتعبئة التصنيف
      populate: {
        path: "category", // اسم الحقل في موديل Course
        model: "Category", // اسم موديل التصنيف
      },
    })
    .populate("studentId")
    .sort({ createdAt: -1 });
  console.log(subscription, "subscription");
  const pendingRequests = await Subscription.countDocuments({
    studentId: req.user._id,
    status: "pending",
  });
  const totalRequests = await Subscription.countDocuments({
    studentId: req.user._id,
  });
  const acceptedRequests = await Subscription.countDocuments({
    studentId: req.user._id,
    status: "confirmed",
  });

  // 'dashboard/index' هو المسار النسبي للملف داخل مجلد 'views'
  res.render("../views/dashboard/student/student_enrollment_requests.ejs", {
    title: "طلباتى ",
    allRequests: subscription,
    stats: {
      totalRequests,
      pendingRequests, // ⬅️ هذا هو الحقل المطلوب
      acceptedRequests,
    },
  });
};
const getRequestDetails = async (req, res, next) => {
  const requestId = req.params.requestId;

  try {
    // 1. جلب بيانات الطلب وتعبئة بيانات الكورس والمدرب (Populaton)
    // نفترض أن حقل courseId يحتوي على تفاصيل الكورس (المتضمنة اسم المدرب)
    const request = await Subscription.findById(requestId)
      .populate({
        path: "courseId",
      })
      .lean();
    console.log(request, "request details");
    console.log(
      request.selectedPriceOption,
      "request course selectedPriceOption"
    );
    if (!request) {
      return res.status(404).render("404", { message: "الطلب غير موجود." });
    }

    // 2. جلب الحصص المرتبطة بهذا الكورس
    let sessions = [];
    // يتم عرض الحصص فقط إذا كانت حالة الطلب (مدفوع أو مقبول)
    if (
      request.courseId &&
      (request.status === "paid" || request.status === "confirmed")
    ) {
      sessions = request.sessions || [];
    }

    // 3. دمج البيانات وإرسالها إلى ملف EJS
    const requestDetails = {
      ...request,
      sessions: sessions,
    };

    res.render("../views/dashboard/student/subscription_details.ejs", {
      pageTitle: `تفاصيل الطلب ${requestId}`,
      requestDetails: requestDetails, // هذا يصبح locals.requestDetails في EJS
    });
  } catch (err) {
    console.error("Error fetching request details:", err);
    // في حالة وجود خطأ في الخادم أو قاعدة البيانات
    res.status(500).render("error", { message: "حدث خطأ داخلي في الخادم." });
  }
};
const getSessionWaitingRoom = async (req, res, next) => {
  console.log('getSessionWaitingRoom')
  const { bookingId, sessionId } = req.params;

  try {
    // 1. البحث عن وثيقة الحجز وجلب بيانات الجلسة المحددة فقط
    const booking = await Subscription.findOne(
      {
        // الشرط 1: البحث باستخدام ID الحجز
        _id: bookingId,
        // الشرط 2: التأكد من أن الجلسة المطلوبة موجودة داخل مصفوفة sessions
        "sessions._id": sessionId,
      },
      {
        // 💡 الإسقاط (Projection): جلب البيانات الأساسية للحجز + الجلسة المحددة فقط
        // `$`: يقوم بإسقاط العنصر الأول في المصفوفة الذي يطابق الشرط في findOne
        courseId: 1, // جلب مرجع الكورس (تحتاجه للتعبئة)
        studentId: 1,
        "sessions.$": 1, // جلب الجلسة المطابقة فقط
      }
    )
      // 2. تعبئة المراجع (Populate)
      .populate({
        path: "courseId",
        select: "title description instructor",
        // يمكنك إضافة تعبئة المدرب هنا إذا كان مرجعاً داخل الكورس
      }) .populate({
       path: "teacherId"
      })
      .lean();
console.log(booking, "booking details");
    if (!booking || !booking.sessions || booking.sessions.length === 0) {
      return res
        .status(404)
        .render("404", { message: "الحجز أو تفاصيل الجلسة غير موجودة." });
    }

    // 3. استخراج كائن الجلسة الفعلي
    const sessionDetails = {
      ...booking.sessions[0], // الجلسة المطلوبة هي العنصر الأول (والوحيد) في المصفوفة
      courseTitle: booking.courseId.title,
      sessionLink: booking.teacherId.zoom_link,
      teacherName: booking.teacherId.name
      
  
      // instructorName: booking.courseId.instructor.name, // إذا قمت بتعبئة المدرب
    };
    console.log(sessionDetails.sessionDetails, "sessionDetails");
    // 4. تمرير البيانات
    res.render("../views/dashboard/student/session-details", {
      pageTitle: `تفاصيل الجلسة ${sessionDetails.date}`,
      sessionDetails: sessionDetails,
    });
  } catch (err) {
    console.error("Error fetching embedded session details:", err);
    res.status(500).render("error", { message: "حدث خطأ داخلي في الخادم." });
  }
};

/**
 * جلب أقرب حصة قادمة (تاريخياً) من بين جميع حجوزات الطالب.
 */
const mongoose = require("mongoose");
const { duration } = require("moment");
const { DateTime } = require("luxon");

async function getNearestSession(studentId, userTimeZone) {
  // جلب الاشتراكات المؤكدة
  const subscriptions = await Subscription.find({
    studentId: studentId,
    status: "confirmed",
  }).populate("courseId");

  let upcoming = [];
  const now = new Date(); // التوقيت الحالي للسيرفر (UTC)

  // نحدد منطقة زمنية افتراضية في حال لم يحدد اليوزر منطقة في بروفايله
  const tz = userTimeZone || "UTC";

  subscriptions.forEach((sub) => {
    (sub.sessions || []).forEach((session) => {
      // 1. استخدام التوقيت العالمي المخزن
      const sessionStart = new Date(session.utcDateAndTime);
      
      // 2. نهاية الحصة (ساعة من البدء)
      const sessionEnd = new Date(sessionStart.getTime() + 60 * 60 * 1000);

      // 3. الفلترة (لم تنتهِ ولم تكتمل)
      if (sessionEnd > now && session.status !== "completed") {
        
        // 4. التحويل لمنطقة اليوزر الممررة للدالة
        const dt = DateTime.fromJSDate(sessionStart, { zone: "utc" })
          .setZone(tz)
          .setLocale('ar');

        upcoming.push({
          bookingId: sub._id,
          courseTitle: sub.courseId?.title,
          sessionDetails: {
            ...session,
            // إضافة البيانات المنسقة للمنطقة الزمنية الخاصة باليوزر
            displayDate: dt.toFormat("yyyy-MM-dd"),
            displayTime: dt.toFormat("hh:mm a"),
            displayDay: dt.toFormat("cccc")
          },
          sessionId: session._id,
          sessionEnd: sessionEnd,
          startTime: sessionStart // للترتيب فقط
        });
      }
    });
  });

  // ترتيب من الأقرب للأبعد
  upcoming.sort((a, b) => a.startTime - b.startTime);
  return upcoming[0] || null;
}
const getStudentCourseDetails = async (studentId) => {
  try {
    const mongoose = require('mongoose');
    const id = new mongoose.Types.ObjectId(studentId);

    const result = await Subscription.aggregate([
      { $match: { studentId: id, status: "confirmed" } },
      
      // ربط الكورس
      {
        $lookup: {
          from: "courses",
          localField: "courseId",
          foreignField: "_id",
          as: "courseInfo"
        }
      },
      { $unwind: "$courseInfo" },

      // إجراء عملية الضرب
      {
        $project: {
          _id: 0,
          courseName: "$courseInfo.title",
          numberOfSessionsPerMonth: 1,
          pricePerSession: { $toDouble: "$selectedPriceOption" },
          // العملية الحسابية (السعر × عدد الحصص)
          totalCalculatedPrice: {
            $multiply: [
              { $toDouble: "$selectedPriceOption" },
              "$numberOfSessionsPerMonth"
            ]
          },
          startDate: 1,
          status: 1
        }
      }
    ]);

    return result[0];
  } catch (error) {
    console.error("Error calculating total:", error);
    return [];
  }
};
const getStudentStats = async (studentId) => {
  try {
    const mongoose = require('mongoose');
    const id = new mongoose.Types.ObjectId(studentId);

    const stats = await Subscription.aggregate([
      // 1. فلترة اشتراكات الطالب المؤكدة فقط
      {
        $match: {
          studentId: id,
          status: "confirmed",
        },
      },
       
      // 3. التجميع وحساب الاحصائيات
     
      // 2. تفكيك الحصص للتعامل مع كل واحدة على حدة
      { $unwind: "$sessions" },
      {
        $group: {
          _id: "$studentId",
          // أ- حصص مكتملة: نعد الجلسات التي حالتها 'completed'
          completedSessions: {
            $sum: { $cond: [{ $eq: ["$sessions.status", "completed"] }, 1, 0] },
          },
          // ب- تقييمك: تحويل المستويات (A,B,C) لأرقام لحساب المتوسط
          avgRating: {
            $avg: {
              $switch: {
                branches: [
                  { case: { $eq: ["$sessions.report.level", "A"] }, then: 5 },
                  { case: { $eq: ["$sessions.report.level", "B"] }, then: 4 },
                  { case: { $eq: ["$sessions.report.level", "C"] }, then: 3 }
                ],
                default: null 
              }
            }
          },
          // ج- دقائق التعلم: بفرض أن كل حصة مكتملة هي ساعة (60 دقيقة) 
          // أو يمكنك استبدال 60 بحقل المدة إذا أضفته
          totalMinutes: {
            $sum: { $cond: [{ $eq: ["$sessions.status", "completed"] }, 60, 0] }
          },
          // د- الخطة: إجمالي الحصص المحجوزة في مصفوفة الجلسات
          totalPlan: { $sum: 1 }
        },
      },
      // 4. التنسيق النهائي للعرض
      {
        $project: {
          _id: 0,
          completedSessions: 1,
       


     
          rating: { $ifNull: [{ $round: ["$avgRating", 1] }, 0] },
          learningMinutes: 1,
          totalPlan: 1,
          learningHours: { $divide: ["$totalMinutes", 60] } // تحويل الساعات لو أردت
        },
      },
    ]);
console.log(stats,'stats');
    return stats.length > 0 ? stats[0] : { 
    
      completedSessions: 0, 
      rating: 0, 
      learningMinutes: 0, 
      totalPlan: 0 
    };
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    return null;
  }
};

const getMySessionsPage = async (req, res) => {
  // 1. جلب البيانات من قاعدة البيانات مع الـ Populates
  const acceptedRequests = await Subscription.find({
    studentId: req.user._id,
    status: "confirmed",
  })
    .populate({
      path: "courseId",
      populate: {
        path: "category",
        model: "Category",
      },
    })
    .populate("studentId").populate("teacherId");

  // 2. تحديد المنطقة الزمنية للمستخدم (أو افتراضية إذا لم توجد)
  const userTimeZone =  req.user.timezone || "Asia/Riyadh";

  // 3. معالجة البيانات لتحويل توقيت كل جلسة (Session)
  const formattedBookings = acceptedRequests.map((sub) => {
    // تحويل وثيقة Mongoose إلى كائن عادي لنتمكن من التعديل عليه
    const booking = sub.toObject();

    if (booking.sessions && Array.isArray(booking.sessions)) {
      booking.sessions = booking.sessions.map((session) => {
        // تحويل التاريخ من UTC إلى المنطقة الزمنية للمستخدم باستخدام Luxon
        const dt = DateTime.fromJSDate(new Date(session.utcDateAndTime), { zone: "utc" })
                   .setZone(userTimeZone)
                   .setLocale('ar'); // لجعل الوقت والتاريخ بالعربية
console.log(booking.teacherId.zoom_link,'zoomLink');
const today = DateTime.now().setZone(userTimeZone).toFormat("yyyy-MM-dd");
     const sessionDate = dt.toFormat("yyyy-MM-dd");
return {
          ...session,
          // إضافة حقول منسقة للعرض في الـ EJS
          displayDate: dt.toFormat("yyyy-MM-dd"), // التاريخ: 2026-01-11
          displayTime: dt.toFormat("hh:mm a"),   // الوقت: 01:15 م
          displayDay: dt.toFormat("cccc"),   
          zoomLink:booking.teacherId.zoom_link,
          isToday: sessionDate === today    // اليوم: الأحد
        };
      });
    }
    return booking;
  });
console.log(formattedBookings.zoomLink, "formattedBookings");
  // 4. إرسال البيانات المنسقة (formattedBookings) بدلاً من الأصلية
  res.render("dashboard/student/my-sessions", {
    title: "حصصي المجدولة",
    bookings: formattedBookings, 
  });
};
const getStudentSettings = async (req, res, next) => {
 
  const user = await User.findById(req.user._id);
     console.log(user,'user new ');
  res.render("dashboard/student/settings", {
    title: "  الاعدادات الطالب ",
    newuser: user,
  });
};

const getStudentBillingPage = async (req, res) => {
    try {
        const studentId = req.user._id; // الحصول على ID الطالب من التوثيق

        const billingData = await Subscription.aggregate([
            // 1. جلب كافة اشتراكات هذا الطالب
            { $match: { studentId: new mongoose.Types.ObjectId(studentId) } },
            
            // 2. ربط بيانات الكورس
            {
                $lookup: {
                    from: "courses",
                    localField: "courseId",
                    foreignField: "_id",
                    as: "courseInfo"
                }
            },
            { $unwind: "$courseInfo" },

            // 3. معالجة البيانات وحساب الحصص المتبقية
            {
                $project: {
                    courseName: "$courseInfo.title",
                    totalSessions: "$numberOfSessionsPerMonth",
                    priceOption: "$selectedPriceOption",
                    totalAmount: 1,
                    status: 1,
                    createdAt: 1,
                    startDate: 1,
                    // حساب الحصص التي لم تكتمل بعد (المتبقية)
                    remainingSessionsCount: {
                        $size: {
                            $filter: {
                                input: "$sessions",
                                as: "sess",
                                cond: { $ne: ["$$sess.status", "completed"] }
                            }
                        }
                    },
                    // حساب تاريخ التجديد (بعد شهر من البداية)
                    renewalDate: { $add: ["$startDate", 30 * 24 * 60 * 60 * 1000] }
                }
            },
            // 4. ترتيب الدفعات من الأحدث للأقدم
            { $sort: { createdAt: -1 } }
        ]);

    console.log(billingData,'billingData');
        // إرسال البيانات للصفحة
        res.render('dashboard/student/billing', { 
            billingData,
            // نعتبر أول سجل هو الخطة النشطة حالياً
            activePlan: billingData.length > 0 ? billingData[0] : null 
        });

    } catch (error) {
        console.error("Billing Page Error:", error);
        res.status(500).send("حدث خطأ في جلب بيانات الرصيد");
    }
};
const getProfilePage = async (req, res) => {
    res.render('dashboard/student/profile_tab', { 
           
        });
};
const getStudentProfilePage = async (req, res) => {
    try {
        const studentId = req.params.id;

        // 1. جلب بيانات الطالب الأساسية
        const student = await User.findById(studentId);
        if (!student) {
            return res.status(404).send('الطالب غير موجود');
        }

        // 2. جلب جميع اشتراكات الطالب مع بيانات الكورسات والمعلمين
        const subscriptions = await Subscription.find({ studentId: studentId })
            .populate('courseId') // لجلب اسم الكورس
            .populate('teacherId'); // لجلب اسم وإيميل المعلم

        // 3. تجهيز البيانات للعرض في التصميم
        // سنقوم بتجميع كل الحصص من جميع الاشتراكات في مصفوفة واحدة لسجل الحصص
        let allSessions = [];
        subscriptions.forEach(sub => {
          console.log(sub,'sub');
            sub.sessions.forEach(session => {
              console.log(session,'session');
                allSessions.push({
                    courseName: sub.courseId ? sub.courseId.title : 'كورس غير مسمى',
                    teacherName: sub.teacherId ? sub.teacherId.name : 'غير محدد',
                    date: session.date,
                    time: session.time,
                    status: session.status,
                    report: session.report,
                    link: sub.teacherId.zoom_link
                });
            });
        });

        // ترتيب الحصص من الأحدث للأقدم
        allSessions.sort((a, b) => new Date(b.date) - new Date(a.date));

        // 4. إرسال البيانات إلى صفحة EJS
        res.render('dashboard/student_profile', {
            student: student,
            subscriptions: subscriptions,
            allSessions: allSessions,
            // استخراج الحرف الأول للايقونة
            initials: student.name ? student.name.charAt(0) : 'S'
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('حدث خطأ في السيرفر');
    }
};
const updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const user = await User.findById(req.user._id);

        // التأكد من تطابق كلمة المرور الجديدة والتأكيد
      if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: "كلمة المرور الجديدة وتأكيدها غير متطابقين." });
        }

        // 3. التحقق من كلمة المرور الحالية (قارن القديمة بالمخزنة)
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "كلمة المرور الحالية غير صحيحة." });
        }

      
        user.password = newPassword;
        await user.save();
res.status(200).json({ message: "تم تغيير كلمة المرور بنجاح." });
    
    } catch (err) {
        console.log(err);
          
            return res.status(400).json({ message:err});
       
     
    }
};

const getStudentSessionsPage = async (req, res) => {
  const userId = req.params.id;
  // 1. جلب البيانات من قاعدة البيانات مع الـ Populates
  const acceptedRequests = await Subscription.find({
    studentId:userId,
    status: "confirmed",
  })
    .populate({
      path: "courseId",
      populate: {
        path: "category",
        model: "Category",
      },
    })
    .populate("studentId").populate("teacherId");

  // 2. تحديد المنطقة الزمنية للمستخدم (أو افتراضية إذا لم توجد)
  const userTimeZone =  req.user.timezone || "Asia/Riyadh";

  // 3. معالجة البيانات لتحويل توقيت كل جلسة (Session)
  const formattedBookings = acceptedRequests.map((sub) => {
    // تحويل وثيقة Mongoose إلى كائن عادي لنتمكن من التعديل عليه
    const booking = sub.toObject();

    if (booking.sessions && Array.isArray(booking.sessions)) {
      booking.sessions = booking.sessions.map((session) => {
        // تحويل التاريخ من UTC إلى المنطقة الزمنية للمستخدم باستخدام Luxon
        const dt = DateTime.fromJSDate(new Date(session.utcDateAndTime), { zone: "utc" })
                   .setZone(userTimeZone)
                   .setLocale('ar'); // لجعل الوقت والتاريخ بالعربية
console.log(booking.teacherId.zoom_link,'zoomLink');
const today = DateTime.now().setZone(userTimeZone).toFormat("yyyy-MM-dd");
     const sessionDate = dt.toFormat("yyyy-MM-dd");
return {
          ...session,
          // إضافة حقول منسقة للعرض في الـ EJS
          displayDate: dt.toFormat("yyyy-MM-dd"), // التاريخ: 2026-01-11
          displayTime: dt.toFormat("hh:mm a"),   // الوقت: 01:15 م
          displayDay: dt.toFormat("cccc"),   
          zoomLink:booking.teacherId.zoom_link,
          isToday: sessionDate === today    // اليوم: الأحد
        };
      });
    }
    return booking;
  });
console.log(formattedBookings.zoomLink, "formattedBookings");
  // 4. إرسال البيانات المنسقة (formattedBookings) بدلاً من الأصلية
  res.render("dashboard/student/my-sessions", {
    title: "حصصي المجدولة",
    bookings: formattedBookings, 
  });
};
module.exports = {
  getStudentProfilePage,
  getStudentSessionsPage,
  getProfilePage,
  updatePassword,
  update_profile,
  getMySessionsPage,
  getStudentSettings,
  getStudentBillingPage,
  getstudentDashboard,
  getAllCourses,
  signup_get,
  login_get,
  registerStudent,
  getSucessSubscriptionPage,
  getBookPlan,
  login_student,
  getEnrolledSubscription,
  getRequestDetails,
  getSessionWaitingRoom,
  getNearestSession, addStudent,
  toggleStatus,
  deleteStudent,
  getAllCoursesForAdminAutoSubscription,
  getAutoAdminBookPlan
};
