
const User = require("../models/user_model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Subscription= require('../models/subscription_model.js');
const handleErrors = (err) => {
  console.log(err.message, err.code);
  let errors = { email: '', password: '' };

  // incorrect email
  if (err.message === 'incorrect email') {
    errors.email = 'That email is not registered';
  }

  // incorrect password
  if (err.message === 'incorrect password') {
    errors.password = 'That password is incorrect';
  }

  // duplicate email error
  if (err.code === 11000) {
    errors.email = 'that email is already registered';
    return errors;
  }

  // validation errors
  if (err.message.includes('user validation failed')) {
    // console.log(err);
    Object.values(err.errors).forEach(({ properties }) => {
      // console.log(val);
      // console.log(properties);
      errors[properties.path] = properties.message;
    });
  }

  return errors;
}
const maxAge = 3 * 24 * 60 * 60;
const createToken = (id) => {
  return jwt.sign({ id }, '01115699209', {
    expiresIn: maxAge
  });
};

const signup_get = (req, res) => {
  res.render("../views/dashboard/teacher/teacher_register");
};
const teacherHome = async (req, res) => {
  try {
    const teacherId = req.user._id;
    const now = new Date();

    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const endOfDay = new Date(now.setHours(23, 59, 59, 999));

    const bookings = await Subscription.find({
      teacherId: teacherId,
      'sessions.date': { $gte: startOfDay, $lte: endOfDay }
    }).populate('studentId courseId');

    let todaysSessions = [];

    bookings.forEach(booking => {
      // هنا التعديل: أضفنا الـ index للحصول على ترتيب الحصة
      booking.sessions.forEach((session, index) => { 
        
        if (new Date(session.date).toDateString() === new Date().toDateString()) {
          
          const [hours, minutes] = session.time.split(':').map(Number);
          const sessionStart = new Date().setHours(hours, minutes-10, 0);
          const sessionEnd = new Date().setHours(hours + 1, minutes, 0);
          const currentTime = new Date().getTime();

          let status = 'upcoming';
          if (currentTime >= sessionStart && currentTime <= sessionEnd) {
            status = 'live';
          } else if (currentTime > sessionEnd) {
            status = 'finished';
          }

          // إضافة البيانات للرابط
          todaysSessions.push({
            bookingId: booking._id,       // تأكد من إضافة هذا السطر
            sessionIndex: index,          // تأكد من إضافة هذا السطر
            title: booking.courseId?.title,
            studentName: booking.studentId?.name,
            time: session.time,
            status: status,
            link: req.user.zoom_link || booking.zoomLink || '#'
          });
        }
      });
    });

    todaysSessions.sort((a, b) => a.time.localeCompare(b.time));

    res.render('../views/dashboard/teacher/teacher_dashboard', { 
      todaysSessions,
      currentDate: new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })
    });
  } catch (err) {
    res.status(500).send("خطأ في تحميل الصفحة الرئيسية");
  }
};
const login_get = (req, res) => {
  res.render("../views/dashboard/login");
};
const finanical_page = (req, res) => {
  res.render("../views/dashboard/teacher/teacher_financial.ejs");
};
const settings_page = (req, res) => {
  const teacher = req.user;
  res.render("../views/dashboard/teacher/teacher_settings.ejs", { teacher });
};
const registerTeacher = async (req, res) => {
  // استخراج البيانات من جسم الطلب
  const {
    name,
    email,
    country_code,
    phone_number,
    gender,
    password,
   zoom_link
  } = req.body;
console.log(req.body);
  try {
    // التحقق من وجود مستخدم بنفس البريد الإلكتروني
    const existingStudent = await User.findOne({ email });
    if (existingStudent) {
      console.log("Email already exists");
      // يمكنك استخدام نظام رسائل flash للمستخدم
      return res
        .status(400)
        .json({
          error: "هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول.",
        });
    }

    // التحقق من تطابق كلمات المرور (يتم يدوياً قبل محاولة الحفظ)
    if (password .length < 6) {
      // نرسل رسالة الخطأ المباشرة
      return res.status(400).json({
        error: "كلمة المرور ضعيفة .  اقل من 6 يرجى التأكد من الإدخال.",
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
      gender:gender,
      zoom_link:zoom_link
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
        const updateData = { name, zoom_link, bio,email };
console.log(req.body);
console.log(req.user.zoom_link);

        // إذا قام المعلم برفع صورة جديدة
        if (req.file) {
            updateData.avatar = req.file.filename;
        }
        if(zoom_link!==req.user.zoom_link){
          console.log(zoom_link,'تغيير اللينك ');
          await Subscription.updateMany(
    { teacherId: req.user._id },
    { $set: { "sessions.$[elem].link": zoom_link } },
    { arrayFilters: [{ "elem.status": "pending" }] } // يطبق التحديث فقط على الحصص المعلقة
);
        }

        await User.findByIdAndUpdate(req.user._id, updateData);
        
        res.redirect('/teacher/home');
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
        if (!user||user==null) {
            // 3. حالة: المستخدم غير موجود (البريد غير صحيح)
            errors.email = 'هذا البريد الإلكتروني غير صحيح';
            res.status(400).json({ errors });
            return; // ⭐️ إيقاف التنفيذ بعد إرسال الاستجابة
        }
        
        // 4. إذا تم العثور على المستخدم، مقارنة كلمة المرور
        const auth = await bcrypt.compare(password, user.password);
        
        if (!auth) {
            // 5. حالة: كلمة المرور غير صحيحة
            errors.password = 'كلمة المرور المدخلة غير صحيحة';
            res.status(400).json({ errors });
            return; // ⭐️ إيقاف التنفيذ بعد إرسال الاستجابة
        } 
        
        // 6. حالة النجاح: كلمة المرور صحيحة
        const token = createToken(user._id);
        await res.cookie('jwt', token, { httpOnly: true, maxAge: maxAge * 1000 });
        console.log(user);
        // إرسال استجابة النجاح
        res.status(200).json({ user: user._id, message: "تم تسجيل الدخول بنجاح." });
        return; // ⭐️ إيقاف التنفيذ بعد إرسال الاستجابة

    } 
    catch (err) {
        // 7. التقاط أخطاء الخادم العامة أو أخطاء قاعدة البيانات
        console.error(err);
        
        // استخدام دالة handleErrors لمعالجة الأخطاء غير المتوقعة (مثل خطأ في الخادم)
        const specificErrors = handleErrors(err); 
        res.status(400).json({ errors: specificErrors });
        return; // ⭐️ إيقاف التنفيذ
    }
}
const getTeacherCalendarPage = async (req, res) => {
    try {
        const teacher = await User.findById(req.params.id);
       
        res.render('../views/dashboard/teacher/teacher_session_table', { teacher });
    } catch (err) {
        res.status(500).send("خطأ في تحميل الصفحة");
    }
};

// API لإمداد التقويم بالبيانات
const getTeacherEvents = async (req, res) => {
    try {
        const teacherId = req.params.id;
        const bookings = await Subscription.find({ teacherId }).populate('studentId');

        let events = [];
        bookings.forEach(booking => {
            if (booking.sessions && booking.sessions.length > 0) {
                booking.sessions.forEach(session => {
                    // تأكد أن الجلسة لها تاريخ ووقت وأنها ليست "ملغاة"
                    if (session.date && session.time) {
                        try {
                            // تحويل التاريخ ليكون بصيغة YYYY-MM-DD
                            const d = new Date(session.date);
                            const datePart = d.toISOString().split('T')[0];
                            
                            // تأكد أن الوقت بصيغة HH:mm (مثلاً 14:30)
                            const startStr = `${datePart}T${session.time}:00`;

                            events.push({
                                title: booking.studentId?.name || 'طالب',
                                start: startStr,
                                backgroundColor: '#4f46e5'
                            });
                        } catch (e) {
                            console.log("Error formatting date for session:", session._id);
                        }
                    }
                });
            }
        });

        console.log("Events found:", events.length); // سيظهر في Terminal السيرفر
        res.json(events);
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
};
// controllers/teacherController.js

const getSchedule = async (req, res) => {
    try {
        // افترضنا أن ID المعلم موجود في req.user بعد تسجيل الدخول
        const teacherId = req.user._id;

        // جلب الحجوزات التي تحتوي على حصص لم تكتمل بعد أو كل الجدول
        const bookings = await Subscription.find({ teacherId: teacherId })
            .populate('studentId', 'name')
            .populate('courseId', 'title');

        // تنظيم البيانات للعرض الأسبوعي (تجميع الحصص حسب التاريخ)
        let weeklySchedule = {};

        bookings.forEach(booking => {
            booking.sessions.forEach(session => {
                const dateKey = new Date(session.date).toISOString().split('T')[0];
                if (!weeklySchedule[dateKey]) {
                    weeklySchedule[dateKey] = {
                        dayName: new Date(session.date).toLocaleDateString('ar-EG', { weekday: 'long' }),
                        dayNumber: new Date(session.date).getDate(),
                        sessions: []
                    };
                }
                weeklySchedule[dateKey].sessions.push({
                    time: session.time,
                    studentName: booking.studentId?.name,
                    courseTitle: booking.courseId?.title,
                    status: session.status
                });
            });
        });

        // ترتيب الأيام زمنياً
        const sortedSchedule = Object.keys(weeklySchedule)
            .sort()
            .reduce((obj, key) => {
                obj[key] = weeklySchedule[key];
                return obj;
            }, {});

        res.render('../views/dashboard/teacher/teacher_time_table', { 
            schedule: sortedSchedule,
            teacherName: req.user.name 
        });
    } catch (err) {
        res.status(500).send("خطأ في جلب الجدول");
    }
};


const getSessionPage = async (req, res) => {
   try {
        const { bookingId, sessionIndex } = req.params;
        const booking = await Subscription.findById(bookingId).populate('studentId courseId');
        const session = booking.sessions[sessionIndex];

        // 1. تحويل وقت الحصة (مثلاً 14:30) إلى كائن تاريخ كامل لليوم
        const [hours, minutes] = session.time.split(':').map(Number);
        const sessionStartTime = new Date(); // تاريخ اليوم
        sessionStartTime.setHours(hours, minutes, 0, 0);

        // 2. تحديد وقت النهاية (بإضافة ساعة واحدة مثلاً)
        const sessionEndTime = new Date(sessionStartTime.getTime() + 60 * 60 * 1000); 

        // 3. حساب الفرق بالثواني بين "الآن" ووقت "النهاية"
        const now = new Date();
        let remainingSeconds = Math.floor((sessionEndTime - now) / 1000);

        // إذا كانت الحصة لم تبدأ بعد أو انتهت، نضبط القيمة
        if (remainingSeconds < 0) remainingSeconds = 0; 
        if (remainingSeconds > 3600) remainingSeconds = 3600; // بحد أقصى ساعة

        res.render('../views/dashboard/teacher/teacher_session', {
            booking,
            session,
            sessionIndex,
            student: booking.studentId,
            remainingSeconds, // هذا الرقم هو الأهم للتايمر
            title: "متابعة الحصة"
        });
    } catch (err) {
        res.status(500).send("خطأ في الخادم");
    }
};

const saveSessionReport = async (req, res) => {
    try {
        const { bookingId, sessionIndex, level, content, instructions } = req.body;
   console.log(req.body);
        const booking = await Subscription.findById(bookingId);
        console.log(booking);
        // تحديث الحصة المحددة داخل مصفوفة الحصص
        booking.sessions[sessionIndex].status = 'completed';
        booking.sessions[sessionIndex].report = {
            level,
            content,
            instructions,
            submittedAt: new Date()
        };

        await booking.save();
        res.redirect('/teacher/home');
    } catch (err) {
        res.status(500).send("خطأ في حفظ التقرير");
    }
};

module.exports = { signup_get, login_get, loginTeacher, registerTeacher,teacherHome ,  getTeacherCalendarPage,
settings_page,finanical_page,   getSchedule, getTeacherEvents, getSessionPage, saveSessionReport,postUpdateProfile };