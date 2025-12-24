const User = require("../models/user_model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Course = require("../models/course_model.js");
const Subscription = require("../models/subscription_model.js");
const getstudentDashboard = async (req, res, next) => {
  try {
    const role = req.user.role;
    // c على أقرب حصة
    if (role === "student") {
      const studentId = req.user._id;
      const nearestSession = await getNearestSession(studentId);

      console.log(nearestSession, "nearestSession in controller");
      res.render("dashboard/student/student-dashboard", {
        title: "لوحة تحكم الطالب",
        nearestSession,
      });
    } else if (role === "teacher") {
      try {
        const teacherId = req.user._id;
        const now = new Date();

        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const endOfDay = new Date(now.setHours(23, 59, 59, 999));

        const bookings = await Subscription.find({
          teacherId: teacherId,
          "sessions.date": { $gte: startOfDay, $lte: endOfDay },
        }).populate("studentId courseId");

        let todaysSessions = [];

        bookings.forEach((booking) => {
          // هنا التعديل: أضفنا الـ index للحصول على ترتيب الحصة
          booking.sessions.forEach((session, index) => {
            if (
              new Date(session.date).toDateString() ===
              new Date().toDateString()
            ) {
              const [hours, minutes] = session.time.split(":").map(Number);
              const sessionStart = new Date().setHours(hours, minutes-10, 0);
              const sessionEnd = new Date().setHours(hours + 1, minutes, 0);
              const currentTime = new Date().getTime();

              let status = "upcoming";
              if (currentTime >= sessionStart && currentTime <= sessionEnd) {
                status = "live";
              } else if (currentTime > sessionEnd) {
                status = "finished";
              }

              // إضافة البيانات للرابط
              todaysSessions.push({
                bookingId: booking._id, // تأكد من إضافة هذا السطر
                sessionIndex: index, // تأكد من إضافة هذا السطر
                title: booking.courseId?.title,
                studentName: booking.studentId?.name,
                time: session.time,
                status: status,
                link: req.user.zoom_link || booking.zoomLink || "#",
              });
            }
          });
        });

        todaysSessions.sort((a, b) => a.time.localeCompare(b.time));

        res.render("../views/dashboard/teacher/teacher_dashboard", {
          todaysSessions,
          currentDate: new Date().toLocaleDateString("ar-EG", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        });
      } catch (err) {
        res.status(500).send("خطأ في تحميل الصفحة الرئيسية");
      }
    } else {
      res.render("dashboard/index");
    }
  } catch (error) {
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
  } = req.body;

  try {
    // التحقق من وجود مستخدم بنفس البريد الإلكتروني
    const existingStudent = await User.findOne({ email });
    if (existingStudent) {
      console.log("Email already exists");
      // يمكنك استخدام نظام رسائل flash للمستخدم
      return res.status(400).json({
        error: "هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول.",
      });
    }

    // التحقق من تطابق كلمات المرور (يتم يدوياً قبل محاولة الحفظ)
    if (password !== confirm_Password) {
      // نرسل رسالة الخطأ المباشرة
      return res.status(400).json({
        error: "كلمتا المرور غير متطابقتين. يرجى التأكد من الإدخال.",
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

    // 🟢 الخطوة الحاسمة: تحليل خطأ Mongoose Validation
    if (err.name === "ValidationError") {
      // تجميع رسائل الأخطاء في مصفوفة (Array)
      const validationMessages = Object.values(err.errors).map(
        (val) => val.message
      );

      // دمج الرسائل في سلسلة نصية واحدة مفصولة بعلامة خاصة (نستخدم هنا ||)
      // هذا يسمح لنا بتقسيمها بسهولة في الجافاسكريبت
      errorMessage = validationMessages.join(" || ");

      // يتم إرسال errorMessage ليكون:
      // "Minimum password length is 6 characters || Please enter a phone number || Please enter a country code"
    } else if (err.code === 11000) {
      // خطأ تكرار (Duplicate Key Error)
      errorMessage = "هذا البريد الإلكتروني مسجل بالفعل.";
    }

    // 📢 عرض الخطأ في الفرونت-إند عبر متغير 'error'
    res.status(400).json({
      error: errorMessage, // تمرير الرسالة المجمعة
    });
  }
};
const maxAge = 3 * 24 * 60 * 60;
const createToken = (id) => {
  return jwt.sign({ id }, "01115699209", {
    expiresIn: maxAge,
  });
};

const login_student = async (req, res) => {
  // 1. استخراج البيانات المطلوبة
  const { email, password, role } = req.body;

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

    if (!booking || !booking.sessions || booking.sessions.length === 0) {
      return res
        .status(404)
        .render("404", { message: "الحجز أو تفاصيل الجلسة غير موجودة." });
    }

    // 3. استخراج كائن الجلسة الفعلي
    const sessionDetails = {
      ...booking.sessions[0], // الجلسة المطلوبة هي العنصر الأول (والوحيد) في المصفوفة
      courseTitle: booking.courseId.title,
      sessionLink: booking.sessions[0].link,
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
const getNearestSession = async (studentId) => {
  // 💡 يجب استبدال هذا بمعرّف الطالب الفعلي، مثلاً من req.user.id

  const now = new Date();

  try {
    const result = await Subscription.aggregate([
      {
        $match: {
          studentId: new mongoose.Types.ObjectId(studentId),
          status: "confirmed",
        },
      },
      { $unwind: "$sessions" },
      {
        $addFields: {
          dateTimeString: {
            $concat: [
              { $dateToString: { format: "%Y-%m-%d", date: "$sessions.date" } },
              "T",
              "$sessions.time",
              ":00Z",
            ],
          },
        },
      },
      {
        $addFields: {
          combinedDateTime: { $toDate: "$dateTimeString" },
        },
      },
      { $match: { combinedDateTime: { $gt: now } } },
      { $sort: { combinedDateTime: 1 } },
      { $limit: 1 },

      {
        $lookup: {
          from: "courses",
          localField: "courseId",
          foreignField: "_id",
          as: "courseDetails",
        },
      },
      { $unwind: "$courseDetails" },

      {
        $project: {
          _id: 0,
          bookingId: "$_id",
          sessionDetails: "$sessions",
          sessionId: "$sessions._id",
          combinedDateTime: 1,
          courseTitle: "$courseDetails.title",
          totalAmount: 1,
        },
      },
    ]);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("Error in getNearestSession:", error);
    return null;
  }
};

const getMySessionsPage = async (req, res) => {
  // 'dashboard/index' هو المسار النسبي للملف داخل مجلد 'views'

  const acceptedRequests = await Subscription.find({
    studentId: req.user._id,
    status: "confirmed",
  })
    .populate({
      path: "courseId", // قم بتعبئة الكورس أولاً
      // داخل الكورس المُعبَّأ، قم بتعبئة التصنيف
      populate: {
        path: "category", // اسم الحقل في موديل Course
        model: "Category", // اسم موديل التصنيف
      },
    })
    .populate("studentId");
  console.log(acceptedRequests, "acceptedRequests");
  res.render("dashboard/student/my-sessions", {
    title: "   حصصى المجدوله ",
    bookings: acceptedRequests,
  });
};
const getStudentSettings = async (req, res) => {
  // 'dashboard/index' هو المسار النسبي للملف داخل مجلد 'views'
  res.render("dashboard/student/settings", {
    title: "  الاعدادات الطالب ",
  });
};
const getStudentBillingPage = async (req, res) => {
  // 'dashboard/index' هو المسار النسبي للملف داخل مجلد 'views'
  res.render("dashboard/student/billing", {
    title: "  الاعدادات الطالب ",
  });
};
module.exports = {
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
  getNearestSession,
};
