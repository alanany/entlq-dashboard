const User = require("../models/user_model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Subscription = require("../models/subscription_model.js");
const handleErrors = (err) => {
  console.log(err.message, err.code);
  let errors = { email: "", password: "" };

  // incorrect email
  if (err.message === "incorrect email") {
    errors.email = "That email is not registered";
  }

  // incorrect password
  if (err.message === "incorrect password") {
    errors.password = "That password is incorrect";
  }

  // duplicate email error
  if (err.code === 11000) {
    errors.email = "that email is already registered";
    return errors;
  }

  // validation errors
  if (err.message.includes("user validation failed")) {
    // console.log(err);
    Object.values(err.errors).forEach(({ properties }) => {
      // console.log(val);
      // console.log(properties);
      errors[properties.path] = properties.message;
    });
  }

  return errors;
};
const maxAge = 3 * 24 * 60 * 60;
const createToken = (id) => {
  return jwt.sign({ id }, "01115699209", {
    expiresIn: maxAge,
  });
};

const signup_get = (req, res) => {
  res.render("../views/dashboard/teacher/teacher_register");
};

/**
 * استخراج التاريخ والوقت من صيغة UTC ISO
 * @param {string} isoString - "2026-01-09T19:11:00.000Z"
 * @param {string} timeZone - "Asia/Dubai" أو "Africa/Cairo"
 */
const { DateTime } = require("luxon");
const Payment = require("../models/Payment.js");
function extractDateTime(utcDate, timeZone) {
  const dt = DateTime.fromISO(utcDate, { zone: "utc" }).setZone(timeZone);

  return {
    date: dt.toFormat("yyyy-MM-dd"),
    time: dt.toFormat("HH:mm"),
  };
}

const teacherHome = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const now = new Date();

    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const endOfDay = new Date(now.setHours(23, 59, 59, 999));
    const teacherStatic = await teacherStatics(req, res);

    const bookings = await Subscription.find({
      teacherId: teacherId,
      "sessions.date": { $gte: startOfDay, $lte: endOfDay },
    }).populate("studentId courseId");

    let todaysSessions = [];

    bookings.forEach((booking) => {
      // هنا التعديل: أضفنا الـ index للحصول على ترتيب الحصة
      booking.sessions.forEach((session, index) => {
        if (
          new Date(session.date).toDateString() === new Date().toDateString()
        ) {
          console.log(session.time, "session.time");
          const [hours, minutes] = session.time.split(":").map(Number);
          const sessionStart = new Date().setHours(hours, minutes - 10, 0);
          const sessionEnd = new Date().setHours(hours + 1, minutes, 0);
          const currentTime = new Date().getTime();

          let status = "upcoming";
          if (currentTime >= sessionStart && currentTime <= sessionEnd) {
            status = "live";
          } else if (currentTime > sessionEnd) {
            status = "finished";
          }
          const result = extractDateTime(
            session.utcDateAndTime,
            req.user.timezone
          );
          console.log(session.utcDateAndTime, "session.utcDateAndTime");
          console.log(req.user.timezone, "req.user.timezone");
          console.log(result, "result");
          // إضافة البيانات للرابط
          todaysSessions.push({
            bookingId: booking._id, // تأكد من إضافة هذا السطر
            sessionIndex: index, // تأكد من إضافة هذا السطر
            title: booking.courseId?.title,
            studentName: booking.studentId?.name,
            time: result.time,
            date: result.date,
            status: status,
            isSendReport: session.report.level == null ? false : true,
            link: req.user.zoom_link || booking.zoomLink || "#",
          });
        }
      });
    });
    console.log(todaysSessions, "todaysSessions");

    todaysSessions.sort((a, b) => a.time.localeCompare(b.time));
    res.render("../views/dashboard/teacher/teacher_dashboard", {
      todaysSessions,
      todaysSessionsNumbers: todaysSessions.length,
      teacherStatic,

      currentDate: new Date().toLocaleDateString("ar-EG", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    });
  } catch (err) {
    res.status(500).send("خطأ في تحميل الصفحة الرئيسية");
  }
};
const teacherStatics = async (req, res) => {
  try {
    // 1. جلب معرف المعلم من الجلسة (بافتراض استخدام Passport.js أو JWT)
    const teacherId = req.user._id;

    // 2. حساب إجمالي عدد الطلاب المشتركين مع هذا المعلم
    const totalStudentsCount = await Subscription.countDocuments({
      teacherId: teacherId,
    });

    const teacherHourlyRate = Number(req.user.hour_rate) || 0;

    // جلب الاشتراكات مع الحصص المكتملة والتي حضرها المعلم فعلياً
    const bookings = await Subscription.find({
      teacherId: teacherId,
      "sessions.status": "completed",
      "sessions.attended": true,
    })
      .populate("studentId", "name")
      .populate("courseId", "title");

    let completedSessions = [];
    const monthlyStats = {};

    bookings.forEach((booking) => {
      booking.sessions.forEach((session) => {
        if (session.status === "completed" && session.attended) {
          // تحويل مدة الحصة (بالدقائق) إلى ساعات للحساب الصحيح
          // مثال: 30 دقيقة تصبح 0.5 ساعة مضروبة في سعر الساعة
          const durationInMinutes = Number(booking.selectedPriceOption) || 60;
          const sessionPrice = teacherHourlyRate * (durationInMinutes / 60);

          // استخراج الشهر من تاريخ الحصة
          const sessionDate = new Date(session.date);
          const monthNum = sessionDate.getMonth() + 1; // من 1 إلى 12

          const sessionInfo = {
            date: session.date,
            time: session.time,
            studentName: booking.studentId?.name || "طالب محذوف",
            courseTitle: booking.courseId?.title || "كورس محذوف",
            price: sessionPrice,
            duration: durationInMinutes,
            month: monthNum,
          };

          completedSessions.push(sessionInfo);

          // بناء إحصائيات الشهور ديناميكياً
          if (!monthlyStats[monthNum]) {
            const monthName = new Intl.DateTimeFormat("ar-EG", {
              month: "long",
            }).format(sessionDate);
            monthlyStats[monthNum] = {
              monthName: monthName,
              total: 0,
              count: 0,
            };
          }
          monthlyStats[monthNum].total += sessionPrice;
          monthlyStats[monthNum].count += 1;
        }
      });
    });

    // ترتيب الحصص من الأحدث للأقدم
    completedSessions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // حساب إجمالي الأرباح الكلي
    const totalEarnings = completedSessions.reduce(
      (sum, s) => sum + s.price,
      0
    );

    // 4. جلب عدد الكورسات التي يقدمها هذا المعلم

    // 5. جلب آخر 5 طلاب انضموا حديثاً (Latest Joins)
    const latestBookings = await Subscription.find({ teacherId: teacherId })
      .sort({ createdAt: -1 }) // الترتيب من الأحدث
      .limit(2)
      .populate("studentId") // جلب بيانات الطالب (الاسم)
      .populate("courseId"); // جلب بيانات الكورس (العنوان)

    const stats = {
      students: totalStudentsCount,
      revenue: totalEarnings,
      courses: 1,
      rating: 4.9,
      latestStudents: latestBookings,
      // يمكن حسابها لاحقاً من جدول التقييمات
    };
    console.log(stats, "stats");
    // 6. رندر الصفحة وإرسال البيانات لـ EJS
    return stats;
  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).send("حدث خطأ في تحميل لوحة التحكم");
  }
};
const login_get = (req, res) => {
  res.render("../views/dashboard/login");
};

const finanical_page = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const teacherHourlyRate = Number(req.user.hour_rate) || 0;

    // 1. جلب سجل المدفوعات التي استلمها المعلم فعلياً من الإدارة
    const paymentHistory = await Payment.find({ teacherId: teacherId })
      .sort({ paymentDate: -1 }) // ترتيب تنازلي (الأحدث أولاً)
      .lean();
    // 2. جلب الاشتراكات والحصص
    const bookings = await Subscription.find({
      teacherId: teacherId,
      "sessions.status": "completed",
    })
      .populate("studentId", "name")
      .populate("courseId", "title");

    let completedSessions = [];
    let totalPendingEarnings = 0;
    const monthlyStats = {};

    bookings.forEach((booking) => {
      booking.sessions.forEach((session) => {
        if (session.status === "completed" && session.attended) {
          const durationInMinutes = Number(booking.selectedPriceOption) || 60;
          const sessionPrice = teacherHourlyRate * (durationInMinutes / 60);

          const sessionDate = new Date(session.date);
          const monthKey = `${sessionDate.getFullYear()}-${
            sessionDate.getMonth() + 1
          }`;

          // إضافة الحصة لقائمة الحصص
          completedSessions.push({
            ...session.toObject(),
            price: sessionPrice,
            courseTitle: booking.courseId?.title,
            studentName: booking.studentId?.name,
            monthKey: monthKey,
            isPaid: session.isPaidByAdmin, // استخدام الحقل الجديد
          });

          // حساب الرصيد المتاح (فقط غير المدفوع)
          if (!session.isPaidByAdmin) {
            totalPendingEarnings += sessionPrice;
          }

          // تجميع إحصائيات الشهور
          if (!monthlyStats[monthKey]) {
            monthlyStats[monthKey] = {
              name: new Intl.DateTimeFormat("ar-EG", {
                month: "long",
                year: "numeric",
              }).format(sessionDate),
              total: 0,
              isPaid: true,
            };
          }
          monthlyStats[monthKey].total += sessionPrice;
          if (!session.isPaidByAdmin) monthlyStats[monthKey].isPaid = false;
        }
      });
    });

    res.render("../views/dashboard/teacher/teacher_financial.ejs", {
      teacherName: req.user.name,
      hourlyRate: teacherHourlyRate,
      totalEarnings: totalPendingEarnings.toFixed(2),
      monthlyStats,
      completedSessions,
      paymentHistory, // سجل الحوالات
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("خطأ في معالجة البيانات المالية");
  }
};
const getAdminTeacherFinancial = async (req, res) => {
  try {
    const teacherId = req.params.id;
    const teacher = await User.findById(teacherId);
    if (!teacher) return res.status(404).send("المعلم غير موجود");

    const teacherHourlyRate = Number(teacher.hour_rate) || 0;

    const bookings = await Subscription.find({
      teacherId: teacherId,
      "sessions.status": "completed",
    })
      .populate("studentId", "name")
      .populate("courseId", "title")
      .lean();

    let unpaidSessions = [];
    let paidSessionsGrouped = {};
    const monthlyStats = {};

    bookings.forEach((booking) => {
      if (booking.sessions && Array.isArray(booking.sessions)) {
        booking.sessions.forEach((session) => {
          if (session.status === "completed") {
            const duration = Number(booking.selectedPriceOption) || 60;
            const sessionPrice = teacherHourlyRate * (duration / 60);
            const sessionDate = new Date(session.date);

            const monthKey = `${sessionDate.getFullYear()}-${
              sessionDate.getMonth() + 1
            }`;
            const monthNameDisplay = new Intl.DateTimeFormat("ar-EG", {
              month: "long",
              year: "numeric",
            }).format(sessionDate);

            const sessionInfo = {
              date: session.date,
              studentName: booking.studentId?.name || "طالب محذوف",
              courseTitle: booking.courseId?.title || "كورس محذوف",
              price: sessionPrice.toFixed(2),
              duration: duration,
            };

            if (session.isPaidByAdmin) {
              if (!paidSessionsGrouped[monthKey]) {
                paidSessionsGrouped[monthKey] = {
                  name: monthNameDisplay,
                  sessions: [],
                  totalPaidInMonth: 0, // لجمع إجمالي الشهر
                };
              }
              paidSessionsGrouped[monthKey].sessions.push(sessionInfo);
              paidSessionsGrouped[monthKey].totalPaidInMonth += sessionPrice; // إضافة السعر للإجمالي
            } else {
              unpaidSessions.push(sessionInfo);
              if (!monthlyStats[monthKey]) {
                monthlyStats[monthKey] = {
                  monthName: monthNameDisplay,
                  total: 0,
                  count: 0,
                  key: monthKey,
                };
              }
              monthlyStats[monthKey].total += sessionPrice;
              monthlyStats[monthKey].count += 1;
            }
          }
        });
      }
    });

    const totalUnpaid = unpaidSessions.reduce(
      (sum, s) => sum + parseFloat(s.price),
      0
    );

    res.render("dashboard/teacher-financial-report", {
      teacher,
      unpaidSessions,
      paidSessionsGrouped,
      monthlyStats,
      totalUnpaid: totalUnpaid.toFixed(2),
    });
  } catch (err) {
    res.status(500).send("خطأ في جلب البيانات المالية");
  }
};
const settings_page = (req, res) => {
  const teacher = req.user;
  res.render("../views/dashboard/teacher/teacher_settings.ejs", { teacher });
};
const registerTeacher = async (req, res) => {
  console.log(req.body), "registerTeacher";

  // استخراج البيانات من جسم الطلب
  const {
    name,
    email,
    country_code,
    phone_number,
    gender,
    password,
    zoom_link,
    timezone,
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
    if (password.length < 6) {
      // نرسل رسالة الخطأ المباشرة
      return res.status(400).json({
        error: "كلمة المرور ضعيفة .  اقل من 6 يرجى التأكد من الإدخال.",
      });
    }
    if (password !== req.body.confirm_password) {
      // نرسل رسالة الخطاء المباشرة
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
      role: "teacher",
      password,
      gender: gender,
      zoom_link: zoom_link,
      timezone: timezone,
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
const postUpdateProfile = async (req, res) => {
  try {
    const email = req.user.email;
    const { name, zoom_link, bio } = req.body;
    const updateData = { name, zoom_link, bio, email };
    console.log(req.body);
    console.log(req.user.zoom_link);

    // إذا قام المعلم برفع صورة جديدة
    if (req.file) {
      updateData.avatar = req.file.filename;
    }
    if (zoom_link !== req.user.zoom_link) {
      console.log(zoom_link, "تغيير اللينك ");
      await Subscription.updateMany(
        { teacherId: req.user._id },
        { $set: { "sessions.$[elem].link": zoom_link } },
        { arrayFilters: [{ "elem.status": "pending" }] } // يطبق التحديث فقط على الحصص المعلقة
      );
    }

    await User.findByIdAndUpdate(req.user._id, updateData);

    res.redirect("/teacher/home");
  } catch (err) {
    console.error(err);
    res.status(500).send("حدث خطأ أثناء التحديث");
  }
};

const loginTeacher = async (req, res) => {
  // 1. استخراج البيانات المطلوبة
  const { email, password, role } = req.body;
  console.log(req.body);
  // **كائن الأخطاء المخصص**
  let errors = {};

  try {
    // 2. البحث عن المستخدم بالبريد والدور
    const user = await User.findOne({ email: email, role: role });
    console.log(user);
    if (!user || user == null) {
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
    console.log(user);
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
const getTeacherCalendarPage = async (req, res) => {
  try {
    const teacher = await User.findById(req.params.id);

    res.render("../views/dashboard/teacher/teacher_session_table", { teacher });
  } catch (err) {
    res.status(500).send("خطأ في تحميل الصفحة");
  }
};

// API لإمداد التقويم بالبيانات
const getTeacherEvents = async (req, res) => {
  try {
    const teacherId = req.params.id;
    const bookings = await Subscription.find({ teacherId }).populate(
      "studentId"
    );

    let events = [];

    bookings.forEach((booking) => {
      if (booking.sessions && booking.sessions.length > 0) {
        booking.sessions.forEach((session, index) => {
          // نستخدم index مباشرة هنا

          if (session.date && session.time) {
            try {
              console.log(session.utcDateAndTime, "session.utcDateAndTime");
              console.log(
                fromUTC(session.utcDateAndTime, req.user.timeZone).date,
                "session.date"
              );
              console.log(
                fromUTC(session.utcDateAndTime, req.user.timeZone).time,
                "session.time"
              );
              // 1. استخراج التاريخ بصيغة YYYY-MM-DD
              const d = fromUTC(session.utcDateAndTime, req.user.timeZone).date;
              const datePart = d;

              // 2. إضافة حرف "Z" في نهاية السلسلة لإخبار المتصفح أن هذا التوقيت هو UTC
              // هذا هو المفتاح الذي سيجعل المتصفح يضيف +3 ساعات (أو حسب منطقة المستخدم)
              const startStrUTC = session.utcDateAndTime;

              events.push({
                bookingId: booking._id,
                sessionIndex: index, // الـ index الصحيح داخل المصفوفة
                isSendReport: session.report && session.report.level != null,
                title: booking.studentId?.name || "طالب",
                start: startStrUTC, // التوقيت بصيغة UTC
                backgroundColor: "#4f46e5",
              });
            } catch (e) {
              console.log("Error formatting date for session:", session._id);
            }
          }
        });
      }
    });

    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
};
// controllers/teacherController.js
function fromUTC(utcDate, timeZone) {
  const dt = DateTime.fromISO(utcDate, { zone: "utc" }).setZone(timeZone);

  return {
    date: dt.toFormat("yyyy-MM-dd"),
    time: dt.toFormat("HH:mm"),
  };
}

const getSchedule = async (req, res) => {
  try {
    const teacherId = req.user._id;

    // 1. تحديد بداية ونهاية الأسبوع الحالي (السبت - الجمعة)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 (الأحد) إلى 6 (السبت)
    const diffToSaturday = dayOfWeek === 6 ? 0 : -(dayOfWeek + 1);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + diffToSaturday);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // 2. جلب الحجوزات
    const bookings = await Subscription.find({ teacherId: teacherId })
      .populate("studentId", "name")
      .populate("courseId", "title");

    let weeklySchedule = {};

    bookings.forEach((booking) => {
      booking.sessions.forEach((session, index) => {
        // أضفنا index هنا
        // ... (داخل دالة bookings.forEach)
        const sessionDate = new Date(session.date);

        if (sessionDate >= startOfWeek && sessionDate <= endOfWeek) {
          const dateKey = sessionDate.toISOString().split("T")[0];

          if (!weeklySchedule[dateKey]) {
            weeklySchedule[dateKey] = {
              dayName: sessionDate.toLocaleDateString("ar-EG", {
                weekday: "long",
              }),
              dayNumber: sessionDate.getDate(),
              sessions: [],
            };
          }

          // التعديل هنا: ندمج التاريخ والوقت في صيغة ISO موحدة
          // نفترض أن session.time مخزن بصيغة "19:30"
          const isoDateTime = `${dateKey}T${session.time}:00Z`;
          console.log(session.utcDateAndTime, "session.utcDateAndTime");
          console.log(
            fromUTC(session.utcDateAndTime, req.user.timeZone).date,
            "session.date"
          );
          console.log(
            fromUTC(session.utcDateAndTime, req.user.timeZone).time,
            "session.time"
          );
          weeklySchedule[dateKey].sessions.push({
            date: fromUTC(session.utcDateAndTime, req.user.timeZone).date,
            time: fromUTC(session.utcDateAndTime, req.user.timeZone).time, // الوقت الخام للعرض الاحتياطي
            fullUTC: session.utcDateAndTime, // هذا الحقل سيستخدمه JavaScript في الواجهة للتحويل
            studentName: booking.studentId?.name,
            courseTitle: booking.courseId?.title,
            status: session.status,
            bookingId: booking._id,
            sessionIndex: index,
          });
        }
      });
    });

    // 4. ترتيب الحصص داخل كل يوم بناءً على الوقت
    Object.keys(weeklySchedule).forEach((date) => {
      weeklySchedule[date].sessions.sort((a, b) =>
        a.time.localeCompare(b.time)
      );
    });

    // 5. ترتيب الأيام زمنياً
    const sortedSchedule = Object.keys(weeklySchedule)
      .sort()
      .reduce((obj, key) => {
        obj[key] = weeklySchedule[key];
        return obj;
      }, {});

    res.render("../views/dashboard/teacher/teacher_time_table", {
      schedule: sortedSchedule,
      teacherName: req.user.name,
      user: req.user, // مهم للـ Monthly Calendar
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("خطأ في جلب الجدول");
  }
};
const getAdminScheduleTeacher = async (req, res) => {
  try {
    const teacherId = req.params.id;
    const teacher = await User.findById(teacherId);
    if (!teacher) return res.status(404).send("المعلم غير موجود");

    // 1. تحديد بداية ونهاية الأسبوع الحالي (السبت - الجمعة)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 (الأحد) إلى 6 (السبت)
    const diffToSaturday = dayOfWeek === 6 ? 0 : -(dayOfWeek + 1);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() + diffToSaturday);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // 2. جلب الحجوزات
    const bookings = await Subscription.find({ teacherId: teacherId })
      .populate("studentId", "name")
      .populate("courseId", "title");

    let weeklySchedule = {};

    bookings.forEach((booking) => {
      booking.sessions.forEach((session, index) => {
        // أضفنا index هنا
        // ... (داخل دالة bookings.forEach)
        const sessionDate = new Date(session.date);

        if (sessionDate >= startOfWeek && sessionDate <= endOfWeek) {
          const dateKey = sessionDate.toISOString().split("T")[0];

          if (!weeklySchedule[dateKey]) {
            weeklySchedule[dateKey] = {
              dayName: sessionDate.toLocaleDateString("ar-EG", {
                weekday: "long",
              }),
              dayNumber: sessionDate.getDate(),
              sessions: [],
            };
          }

          // التعديل هنا: ندمج التاريخ والوقت في صيغة ISO موحدة
          // نفترض أن session.time مخزن بصيغة "19:30"
          const isoDateTime = `${dateKey}T${session.time}:00Z`;
          console.log(session.utcDateAndTime, "session.utcDateAndTime");
          console.log(
            fromUTC(session.utcDateAndTime, teacher.timeZone).date,
            "session.date"
          );
          console.log(
            fromUTC(session.utcDateAndTime, teacher.timeZone).time,
            "session.time"
          );
          weeklySchedule[dateKey].sessions.push({
            date: fromUTC(session.utcDateAndTime, teacher.timeZone).date,
            time: fromUTC(session.utcDateAndTime, teacher.timeZone).time, // الوقت الخام للعرض الاحتياطي
            fullUTC: session.utcDateAndTime, // هذا الحقل سيستخدمه JavaScript في الواجهة للتحويل
            studentName: booking.studentId?.name,
            courseTitle: booking.courseId?.title,
            status: session.status,
            bookingId: booking._id,
            sessionIndex: index,
          });
        }
      });
    });

    // 4. ترتيب الحصص داخل كل يوم بناءً على الوقت
    Object.keys(weeklySchedule).forEach((date) => {
      weeklySchedule[date].sessions.sort((a, b) =>
        a.time.localeCompare(b.time)
      );
    });

    // 5. ترتيب الأيام زمنياً
    const sortedSchedule = Object.keys(weeklySchedule)
      .sort()
      .reduce((obj, key) => {
        obj[key] = weeklySchedule[key];
        return obj;
      }, {});

    res.render("../views/dashboard/teacher/teacher_time_table", {
      schedule: sortedSchedule,
      teacherName: teacher.name,
      user: teacher, // مهم للـ Monthly Calendar
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("خطأ في جلب الجدول");
  }
};
const getSessionPage = async (req, res) => {
  try {
    const { bookingId, sessionIndex } = req.params;
    const booking = await Subscription.findById(bookingId).populate(
      "studentId courseId"
    );
    const session = booking.sessions[sessionIndex];

    // 1. تحويل وقت الحصة (مثلاً 14:30) إلى كائن تاريخ كامل لليوم

    res.render("../views/dashboard/teacher/teacher_session", {
      booking,
      session,
      sessionIndex,
      student: booking.studentId,

      title: "متابعة الحصة",
    });
  } catch (err) {
    res.status(500).send("خطأ في الخادم");
  }
};

const saveSessionReport = async (req, res) => {
  try {
    const { bookingId, sessionIndex, level, content, instructions } = req.body;

    const booking = await Subscription.findById(bookingId);
    console.log(booking);
    // تحديث الحصة المحددة داخل مصفوفة الحصص
    booking.sessions[sessionIndex].status = "completed";
    booking.sessions[sessionIndex].attended = true;

    booking.sessions[sessionIndex].report = {
      level,
      content,
      instructions,
      submittedAt: new Date(),
    };

    await booking.save();
    res.status(200).json({
      success: true,
      message: "تم حفظ التقرير بنجاح",
    });
  } catch (err) {
    res.status(500).send("خطأ في حفظ التقرير");
  }
};
const studentGetpage = async (req, res) => {
  try {
    // 1. جلب بيانات المعلم من الجلسة (Session)
    const teacherId = req.user._id;

    // 2. جلب الطلاب المشتركين مع هذا المعلم فقط
    // ملاحظة: نقوم بجلب الحجوزات التي تخص هذا المعلم ثم "عمل Populating" لبيانات الطلاب
    const bookings = await Subscription.find({ teacherId: teacherId })
      .populate("studentId") // جلب بيانات الطالب (الاسم، البريد)
      .populate("courseId"); // جلب بيانات الكورس (العنوان)
    // 3. تحويل البيانات لشكل بسيط يسهل التعامل معه في EJS
    const students = bookings.map((book) => {
      return {
        _id: book.studentId._id,
        name: book.studentId.name,
        email: book.studentId.email,
        numberOfSessionsPerMonth: book.numberOfSessionsPerMonth,
        courseTitle:
          book.courseId == null ? "كورس غير محدد" : book.courseId.title,
        progress: book.progress || 0, // نسبة الإنجاز
        isActive: book.status === "confirmed",
        completedSessions: book.sessions.filter(
          (session) => session.status === "completed"
        ).length,
      };
    });
    console.log(students);

    // 4. رندر الصفحة وإرسال البيانات
    res.render("../views/dashboard/teacher/teacher_students", {
      user: req.user, // بيانات المعلم للهيدر
      students: students, // قائمة الطلاب للجدول
    });
  } catch (err) {
    console.error("Error fetching students:", err);
    res.status(500).send("حدث خطأ في جلب البيانات");
  }
};
// routes/teacher.js أو في ملف السيرفر الأساسي

const getTeacherPage = async (req, res) => {
  try {
    const teacherId = req.params.id;
    const teacher = await User.findById(teacherId);
    if (!teacher) return res.status(404).send("المعلم غير موجود");

    const teacherHourlyRate = Number(teacher.hour_rate) || 0;

    const allSubscriptions = await Subscription.find({ teacherId: teacherId })
      .populate("studentId")
      .populate("courseId")
      .lean();

    let totalPendingEarnings = 0;
    let completedSessionsCountAll = 0;
    let totalRemainingAll = 0;

    // 💡 الحل هنا: استخدام Object لتجميع الاشتراكات لكل طالب
    const studentsMap = {};

    allSubscriptions.forEach((sub) => {
      const student = sub.studentId;
      if (!student) return;

      const studentId = student._id.toString();

      // حسابات الحصص والأرباح لهذا الاشتراك المعين
      const actualCompleted = sub.sessions ? sub.sessions.filter((s) => s.status === "completed").length : 0;
      const unpaidCompleted = sub.sessions ? sub.sessions.filter((s) => s.status === "completed" && s.isPaidByAdmin !== true).length : 0;
      const totalPlanned = sub.sessions ? sub.sessions.length : 0;
      const remaining = Math.max(0, totalPlanned - actualCompleted);
      
      const duration = Number(sub.selectedPriceOption) || 60;
      const subPendingEarnings = unpaidCompleted * (teacherHourlyRate * (duration / 60));

      // تحديث الإحصائيات العامة
      totalPendingEarnings += subPendingEarnings;
      completedSessionsCountAll += actualCompleted;
      totalRemainingAll += remaining;

      // إذا كان الطالب موجود مسبقاً، نحدث بياناته، وإذا لم يكن موجوداً ننشئه
      if (studentsMap[studentId]) {
        studentsMap[studentId].courses.push(sub.courseId?.title || "كورس غير محدد");
        studentsMap[studentId].totalSessions += totalPlanned;
        studentsMap[studentId].completedSessions += actualCompleted;
        studentsMap[studentId].remainingSessions += remaining;
        // نحدث الحالة: إذا كان لسه عنده حصص في أي كورس يبقى "in-progress"
        if (remaining > 0) studentsMap[studentId].status = "in-progress";
      } else {
        studentsMap[studentId] = {
          id: studentId,
          name: student.name || "طالب محذوف",
          image: student.image, 
          courses: [sub.courseId?.title || "كورس غير محدد"],
          totalSessions: totalPlanned,
          completedSessions: actualCompleted,
          remainingSessions: remaining,
          startDate: sub.startDate ? new Date(sub.startDate).toLocaleDateString("ar-EG") : "غير محدد",
          status: remaining === 0 ? "completed" : "in-progress",
        };
      }
    });

    // تحويل الـ Map إلى مصفوفة لعرضها في EJS
    const processedStudents = Object.values(studentsMap);

    res.render("dashboard/teacher-details.ejs", {
      teacher,
      students: processedStudents,
      stats: {
        totalStudents: processedStudents.length, // الآن سيعطي 1 بدلاً من 3 إذا كان نفس الطالب
        totalEarnings: totalPendingEarnings.toFixed(2),
        completedSessionsCount: completedSessionsCountAll,
        totalRemainingSessions: totalRemainingAll,
      },
      currentDate: new Date().toLocaleDateString("ar-EG"),
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("خطأ في السيرفر");
  }
};
// controller/adminController.js

const processTeacherSalary = async (req, res) => {
  try {
    const { teacherId, monthKey, amount } = req.body;
    // 💡 نصيحة: أرسل من الفرونت إند monthKey بصيغة "2024-5" بدلاً من "مايو"
    console.log(teacherId, monthKey, amount, "بيانات الدفع");
    const newPayment = new Payment({
      teacherId,
      amount: parseFloat(amount),
      month: monthKey, // حفظ الكي الموحد
      paymentDate: new Date(),
      adminId: req.user._id,
      status: "paid",
    });
    await newPayment.save();

    const subscriptions = await Subscription.find({ teacherId: teacherId });

    for (let sub of subscriptions) {
      let hasChanged = false;

      sub.sessions.forEach((session) => {
        if (session.status === "completed" && !session.isPaidByAdmin) {
          const sessionDate = new Date(session.date);
          // إنشاء مفتاح فريد للحصة: "السنة-الشهر"
          const sessionMonthKey = `${sessionDate.getFullYear()}-${
            sessionDate.getMonth() + 1
          }`;

          // المقارنة الآن بين مفاتيح رقمية لا تخطئ
          if (sessionMonthKey === monthKey) {
            session.isPaidByAdmin = true;
            hasChanged = true;
          }
        }
      });

      if (hasChanged) {
        // 💡 ملاحظة: إذا كنت تستخدم Mongoose، أحياناً التعديل داخل المصفوفة يحتاج إخبار الموديل بالتغيير
        sub.markModified("sessions");
        await sub.save();
      }
    }

    res.status(200).json({ message: "تم التحديث بنجاح" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "فشل في المعالجة" });
  }
};

const updateTeacherStatus = async (req, res) => {
  try {
    const { teacherId, isActive } = req.body;
    console.log(teacherId, isActive, "بيانات التحديث");

    // إذا كان الإجراء هو "أرشفة" (تعطيل الحساب)
    if (isActive === false) {
      // البحث عن أي حصص مكتملة لم يتم دفعها بعد لهذا المعلم
      const unpaidSubscription = await Subscription.findOne({
        teacherId: teacherId,
        sessions: {
          $elemMatch: {
            status: "completed",
            isPaidByAdmin: { $ne: true },
          },
        },
      });

      if (unpaidSubscription) {
        return res.status(400).json({
          success: false,
          error:
            "لا يمكن أرشفة المعلم! يوجد حصص منجزة لم يتم دفع مستحقاتها. يرجى تصفية الحساب المالي أولاً.",
        });
      }
    }

    // تحديث الحالة في موديل المستخدم
    await User.findByIdAndUpdate(teacherId, { isActive: isActive });

    res.json({
      success: true,
      message: isActive
        ? "تم تفعيل حساب المعلم بنجاح"
        : "تم نقل المعلم للأرشيف بنجاح",
    });
  } catch (error) {
    console.error("Error in updateTeacherStatus:", error);
    res
      .status(500)
      .json({ success: false, error: "حدث خطأ في السيرفر أثناء تحديث الحالة" });
  }
};

/**
 * الحذف النهائي للمعلم
 */
const deleteTeacher = async (req, res) => {
  try {
    const teacherId = req.params.id;

    // 1. التحقق من وجود مستحقات مالية معلقة قبل الحذف النهائي
    const unpaidCheck = await Subscription.findOne({
      teacherId: teacherId,
      sessions: {
        $elemMatch: {
          status: "completed",
          isPaidByAdmin: { $ne: true },
        },
      },
    });

    if (unpaidCheck) {
      return res.status(400).json({
        success: false,
        message:
          "خطأ: لا يمكن حذف المعلم نهائياً وهناك مبالغ لم تُصرف له. قم بالأرشفة أو الدفع أولاً.",
      });
    }

    // 2. التحقق من وجود اشتراكات جارية (طلاب نشطين)
    const activeSubs = await Subscription.findOne({
      teacherId: teacherId,
      status: "active",
    });

    if (activeSubs) {
      return res.status(400).json({
        success: false,
        message: "لا يمكن الحذف! المعلم مرتبط باشتراكات طلاب نشطة حالياً.",
      });
    }

    // 3. التنفيذ في حال اجتياز الشروط
    await User.findByIdAndDelete(teacherId);

    // ملاحظة: يُفضل أحياناً حذف أو تحديث الاشتراكات المرتبطة به لتجنب Database Orphans
    // await Subscription.deleteMany({ teacherId: teacherId });

    res.json({ success: true, message: "تم حذف المعلم نهائياً من النظام" });
  } catch (error) {
    console.error("Error in deleteTeacher:", error);
    res
      .status(500)
      .json({ success: false, message: "حدث خطأ أثناء محاولة الحذف" });
  }
};

module.exports = {
  getAdminScheduleTeacher,
  updateTeacherStatus,
  deleteTeacher,
  processTeacherSalary,
  getAdminTeacherFinancial,
  getTeacherPage,
  teacherStatics,
  studentGetpage,
  signup_get,
  login_get,
  loginTeacher,
  registerTeacher,
  teacherHome,
  getTeacherCalendarPage,
  settings_page,
  finanical_page,
  getSchedule,
  getTeacherEvents,
  getSessionPage,
  saveSessionReport,
  postUpdateProfile,
};
