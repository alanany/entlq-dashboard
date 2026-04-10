const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { DateTime } = require("luxon");
const { AppDataSource } = require('../config/database');
const teacherController = require("../controllers/teacher_controller");
const courseController = require("../controllers/courseController");

const getNearestSession = async (studentId, userTimeZone) => {
  const subscriptionRepository = AppDataSource.getRepository('Subscription');
  const subscriptions = await subscriptionRepository.find({
    where: { student: { id: parseInt(studentId) }, status: "confirmed" },
    relations: ["course"]
  });

  let upcoming = [];
  const now = new Date();
  const tz = userTimeZone || "UTC";

  subscriptions.forEach((sub) => {
    (sub.sessions || []).forEach((session, index) => {
      const sessionStart = new Date(session.utcDateAndTime);
      const sessionEnd = new Date(sessionStart.getTime() + 60 * 60 * 1000);

      if (sessionEnd > now && session.status !== "completed") {
        const dt = DateTime.fromJSDate(sessionStart, { zone: "utc" })
          .setZone(tz)
          .setLocale('ar');
        upcoming.push({
          bookingId: sub.id,
          courseTitle: sub.course?.title,
          sessionDetails: {
            ...session,
            displayDate: dt.toFormat("yyyy-MM-dd"),
            displayTime: dt.toFormat("hh:mm a"),
            displayDay: dt.toFormat("cccc")
          },
          sessionId: index,
          sessionEnd: sessionEnd,
          startTime: sessionStart 
        });
      }
    });
  });

  upcoming.sort((a, b) => a.startTime - b.startTime);
  return upcoming[0] || null;
};

const getStudentStats = async (studentId) => {
  try {
    const subscriptionRepository = AppDataSource.getRepository('Subscription');
    const subscriptions = await subscriptionRepository.find({ 
        where: { student: { id: parseInt(studentId) }, status: "confirmed" } 
    });

    let completedSessions = 0;
    let totalMinutes = 0;
    let totalPlan = 0;
    let totalScore = 0;
    let ratingCount = 0;
    
    subscriptions.forEach(sub => {
        if (sub.sessions) {
            sub.sessions.forEach(sess => {
                totalPlan++;
                if (sess.status === 'completed') {
                    completedSessions++;
                    totalMinutes += 60;
                }
                if (sess.report && sess.report.level) {
                    const levelToScore = { 'A': 5, 'B': 4, 'C': 3 };
                    if (levelToScore[sess.report.level]) {
                        totalScore += levelToScore[sess.report.level];
                        ratingCount++;
                    }
                }
            });
        }
    });
    
    const avgRating = ratingCount > 0 ? (totalScore / ratingCount) : 0;
    
    return {
        completedSessions,
        rating: parseFloat(avgRating.toFixed(1)),
        learningMinutes: totalMinutes,
        learningHours: parseFloat((totalMinutes / 60).toFixed(1)),
        totalPlan
    };
  } catch (error) {
    return { completedSessions: 0, rating: 0, learningMinutes: 0, totalPlan: 0 };
  }
};

const getStudentCourseDetails = async (studentId) => {
  try {
    const subscriptionRepository = AppDataSource.getRepository('Subscription');
    const result = await subscriptionRepository.createQueryBuilder("sub")
      .innerJoinAndSelect("sub.course", "course")
      .where("sub.studentId = :studentId", { studentId: parseInt(studentId) })
      .andWhere("sub.status = 'confirmed'")
      .select([
        "course.title AS courseName",
        "sub.numberOfSessionsPerMonth AS numberOfSessionsPerMonth",
        "CAST(sub.selectedPriceOption AS DECIMAL) AS pricePerSession",
        "(CAST(sub.selectedPriceOption AS DECIMAL) * sub.numberOfSessionsPerMonth) AS totalCalculatedPrice",
        "sub.startDate AS startDate",
        "sub.status AS status"
      ]).getRawMany();
      
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    return null;
  }
};

const getstudentDashboard = async (req, res, next) => {
  try {
    const role = req.user.role;
    if (role === "student") {
      const studentId = req.user.id || req.user._id;
      const nearestSession = await getNearestSession(studentId, req.user.timezone);
      const studentStats = await getStudentStats(studentId);
      const courseBookingDetails = await getStudentCourseDetails(studentId);

      res.render("dashboard/student/student-dashboard", {
        title: "لوحة تحكم الطالب",
        nearestSession,
        studentStats,
        courseBookingDetails,
        user: req.user
      });
    } else if (role === "teacher") {
      await teacherController.teacherHome(req, res, next);
    } else if (role === "supervisor") {
      return res.redirect('/supervisor');
    } else {
      const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
      const stats = await courseController.getDashboardStats(academyId);
      res.render("../views/dashboard/index", {
        title: "Dashboard",
        user: req.user,
        stats: stats
      });
    }
  } catch (error) {
    res.status(500).render("error", { message: "حدث خطأ أثناء تحميل لوحة التحكم." });
  }
};

const getSucessSubscriptionPage = async (req, res) => {
  res.render("dashboard/student/subscribe-confirm", { title: "نجاح الاشتراك" });
};

const signup_get = (req, res) => { res.render("../views/dashboard/student/register"); };
const login_get = (req, res) => { res.render("../views/dashboard/student/login"); };

const addStudent = async (req, res) => {
  try {
    const { name, email, country_code, phone_number, gender, password, timezone } = req.body;
    const normalizedEmail = email ? email.trim().toLowerCase() : '';
    const userRepository = AppDataSource.getRepository('User');
    
    const existingStudent = await userRepository.findOne({ where: { email: normalizedEmail } });
    if (existingStudent) {
        return res.status(400).json({ success: false, message: 'البريد الإلكتروني مسجل مسبقاً' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newStudent = userRepository.create({
        name, email: normalizedEmail, country_code, phone_number,
        gender, password: hashedPassword, timezone,
        role: 'student', status: 'active',
        academy: { id: req.user.academyId || (req.user.academy && req.user.academy.id) }
    });

    await userRepository.save(newStudent);
    res.status(200).json({ success: true, message: 'تم تسجيل الطالب بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء التسجيل' });
  }
};

const toggleStatus = async (req, res) => {
  try {
    const { studentId, isActive } = req.body;
    const userRepository = AppDataSource.getRepository('User');
    await userRepository.update(studentId, { status: isActive ? 'active' : 'archived' });
    res.json({ success: true, message: isActive ? "تم تفعيل حساب الطالب بنجاح" : "تم نقل الطالب للأرشيف بنجاح" });
  } catch (error) {
    res.status(500).json({ success: false, error: "حدث خطأ في السيرفر أثناء تحديث الحالة" });
  }
};

const deleteStudent = async (req, res) => {
  try {
    const userRepository = AppDataSource.getRepository('User');
    await userRepository.delete(req.params.id);
    res.status(200).json({ success: true, message: 'تم الحذف بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء الحذف' });
  }
};

const registerStudent = async (req, res) => {
  const { name, email, country_code, phone_number, gender, password, confirm_Password, timezone } = req.body;
  const normalizedEmail = email ? email.trim().toLowerCase() : '';

  try {
    if (!name || !email || !phone_number || !gender || !password || !confirm_Password || !timezone) {
      return res.status(400).json({
        error: "الحقول مطلوبة",
        errors: { general: "الحقول مطلوبة" }
      });
    }

    const userRepository = AppDataSource.getRepository('User');
    const existingStudent = await userRepository.findOne({ where: { email: normalizedEmail } });
    if (existingStudent) {
      return res.status(400).json({ error: "هذا البريد الإلكتروني مسجل بالفعل.", errors: { email: "مسجل بالفعل" } });
    }

    if (password !== confirm_Password) {
      return res.status(400).json({ error: "كلمتا المرور غير متطابقتين.", errors: { password: "غير متطابقتين" } });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = userRepository.create({
      name, email: normalizedEmail, country_code, phone_number: country_code + phone_number,
      gender, password: hashedPassword, timezone, role: "student", status: 'active'
    });
    
    await userRepository.save(user);

    res.status(200).json({ message: "تم التسجيل بنجاح." });
  } catch (err) {
    res.status(400).json({ error: "حدث خطأ غير متوقع", message: "حدث خطأ" });
  }
};

const maxAge = 3 * 24 * 60 * 60;
const createToken = (id) => {
  return jwt.sign({ id }, "01115699209", { expiresIn: maxAge });
};

const update_profile = async (req, res) => {
    try {
        const { name, phone_number, gender, timezone } = req.body;
        const userRepository = AppDataSource.getRepository('User');
        const userId = req.user.id || req.user._id;

        let user = await userRepository.findOne({ where: { id: userId } });
        user = userRepository.merge(user, { name, phone_number, gender, timezone });
        await userRepository.save(user);

        res.status(200).json({ success: true, message: "تم تحديث الملف الشخصي بنجاح.", user });
    } catch (err) {
        res.status(400).json({ success: false, message: "حدث خطأ أثناء تحديث الملف الشخصي." });
    }
};

const login_student = async (req, res) => {
  const { email, password, role, timezone } = req.body;
  const normalizedEmail = email ? email.trim().toLowerCase() : '';

  try {
    const userRepository = AppDataSource.getRepository('User');
    const user = await userRepository.findOne({ where: { email: normalizedEmail, role } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
    }

    if (timezone && user.timezone !== timezone) {
      await userRepository.update(user.id, { timezone });
    }

    const token = createToken(user.id);
    res.cookie("jwt", token, { httpOnly: true, maxAge: maxAge * 1000 });
    res.status(200).json({ user: user.id, message: "تم تسجيل الدخول بنجاح." });
  } catch (err) {
    res.status(400).json({ errors: { general: "خطأ بالخادم" } });
  }
};

const getAllCourses = async (req, res) => {
  const academyId = req.user ? (req.user.academyId || (req.user.academy && req.user.academy.id)) : null;
  const courseRepository = AppDataSource.getRepository('Course');
  const courses = await courseRepository.find({ where: { academy: { id: parseInt(academyId) } } });
  
  res.render("../views/dashboard/student/course-list", { title: "كورسات الموقع", courses, user: req.user });
};

const getAllCoursesForAdminAutoSubscription = async (req, res) => {
  const userRepository = AppDataSource.getRepository('User');
  const courseRepository = AppDataSource.getRepository('Course');
  
  const student = await userRepository.findOne({ where: { id: parseInt(req.params.studentId) }, relations: ['academy'] });
  const academyId = student && student.academy ? student.academy.id : null;
  
  let courses = [];
  if (academyId) {
      courses = await courseRepository.find({ where: { academy: { id: parseInt(academyId) } } });
  }
  
  res.render("../views/dashboard/student/course-list", { title: "كورسات الموقع", courses, studentId: req.params.studentId });
};

const getBookPlan = async (req, res) => {
  try {
    const academyId = req.user ? (req.user.academyId || (req.user.academy && req.user.academy.id)) : null;
    const courseRepository = AppDataSource.getRepository('Course');
    const course = await courseRepository.findOne({ where: { id: parseInt(req.params.id), academy: { id: parseInt(academyId) } }, relations: ["category"] });
    
    if (!course) return res.status(404).render("404", { message: "الدورة غير موجودة." });

    res.render("../views/dashboard/student/book-plan", { title: `حجز الدورة:`, course });
  } catch (err) {
    res.status(500).render("error", { message: "فشل في تحميل بيانات الدورة." });
  }
};

const getAutoAdminBookPlan = async (req, res) => {
  try {
    const courseRepository = AppDataSource.getRepository('Course');
    const course = await courseRepository.findOne({ where: { id: parseInt(req.params.id) }, relations: ["category"] });
    
    if (!course) return res.status(404).render("404", { message: "الدورة غير موجودة." });

    res.render("../views/dashboard/student/book-plan", { title: `حجز الدورة:`, course, studentId: req.params.studentId });
  } catch (err) {
    res.status(500).render("error", { message: "فشل في تحميل بيانات الدورة." });
  }
};

const getEnrolledSubscription = async (req, res) => {
  const subscriptionRepository = AppDataSource.getRepository('Subscription');
  const studentId = req.user.id || req.user._id;

  const subscription = await subscriptionRepository.find({ 
      where: { student: { id: parseInt(studentId) } },
      relations: ["course", "course.category", "student", "teacher"],
      order: { createdAt: 'DESC' }
  });

  const pendingRequests = await subscriptionRepository.count({ where: { student: { id: parseInt(studentId) }, status: "pending" } });
  const totalRequests = await subscriptionRepository.count({ where: { student: { id: parseInt(studentId) } } });
  const acceptedRequests = await subscriptionRepository.count({ where: { student: { id: parseInt(studentId) }, status: "confirmed" } });

  const subscriptionsWithRenewal = subscription.map(sub => {
      const subObj = { ...sub };
      let isRenewable = false;
      if (subObj.status === 'confirmed' || subObj.status === 'paid') {
          const startDate = new Date(subObj.startDate || subObj.createdAt);
          const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000); 
          const diffDays = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24)); 
          
          let remainingSessions = 0;
          if (subObj.sessions && Array.isArray(subObj.sessions)) {
              remainingSessions = subObj.sessions.filter(s => s.status === 'pending').length;
          }

          if (diffDays < 5 || (remainingSessions < 2 && remainingSessions > 0)) {
              isRenewable = true;
          }
      }
      subObj.isRenewable = isRenewable;
      return subObj;
  });

  res.render("../views/dashboard/student/student_enrollment_requests.ejs", {
      title: "طلباتى ",
      allRequests: subscriptionsWithRenewal,
      stats: { totalRequests, pendingRequests, acceptedRequests },
  });
};

const getRequestDetails = async (req, res, next) => {
  try {
    const requestId = req.params.requestId;
    const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
    const subscriptionRepository = AppDataSource.getRepository('Subscription');

    const request = await subscriptionRepository.findOne({ 
        where: { id: parseInt(requestId), academy: { id: parseInt(academyId) } },
        relations: ["course", "teacher"] 
    });

    if (!request) return res.status(404).render("404", { message: "الطلب غير موجود." });

    let sessions = [];
    if (request.course && (request.status === "paid" || request.status === "confirmed")) {
      sessions = request.sessions || [];
    }

    let isRenewable = false;
    if (request.status === 'confirmed' || request.status === 'paid') {
        const startDate = new Date(request.startDate || request.createdAt);
        const diffDays = Math.ceil(((startDate.getTime() + 30 * 24 * 60 * 60 * 1000) - new Date()) / (1000 * 60 * 60 * 24));
        let remainingSessions = (request.sessions || []).filter(s => s.status === 'pending').length;
        if (diffDays < 5 || (remainingSessions < 2 && remainingSessions > 0)) isRenewable = true;
    }

    res.render("../views/dashboard/student/subscription_details.ejs", {
      pageTitle: `تفاصيل الطلب ${requestId}`,
      requestDetails: { ...request, sessions, isRenewable }, 
    });
  } catch (err) {
    res.status(500).render("error", { message: "حدث خطأ داخلي في الخادم." });
  }
};

const getSessionWaitingRoom = async (req, res, next) => {
  const { bookingId, sessionId } = req.params;
  try {
    const subscriptionRepository = AppDataSource.getRepository('Subscription');
    const booking = await subscriptionRepository.findOne({ 
        where: { id: parseInt(bookingId) },
        relations: ["course", "teacher"]
    });

    if (!booking || !booking.sessions || !booking.sessions[sessionId]) {
      return res.status(404).render("404", { message: "الحجز أو تفاصيل الجلسة غير موجودة." });
    }

    const session = booking.sessions[sessionId];
    const userTimeZone = req.user?.timezone || "Asia/Riyadh";
    const dt = DateTime.fromJSDate(new Date(session.utcDateAndTime), { zone: "utc" })
               .setZone(userTimeZone).setLocale('ar');

    const sessionDetails = {
      ...session,
      courseTitle: booking.course?.title,
      courseId: booking.course?.id,
      teacherId: booking.teacher?.id,
      sessionLink: booking.teacher?.zoom_link,
      teacherName: booking.teacher?.name,
      displayDate: dt.toFormat("yyyy-MM-dd"),
      displayTime: dt.toFormat("hh:mm a"),
      displayDay: dt.toFormat("cccc"),
      utcDateAndTime: session.utcDateAndTime
    };

    res.render("../views/dashboard/student/session-details", {
      pageTitle: `تفاصيل الجلسة ${sessionDetails.date}`,
      sessionDetails,
    });
  } catch (err) {
    res.status(500).render("error", { message: "حدث خطأ داخلي في الخادم." });
  }
};

const getMySessionsPage = async (req, res) => {
  const subscriptionRepository = AppDataSource.getRepository('Subscription');
  const userId = req.user.id || req.user._id;
  const acceptedRequests = await subscriptionRepository.find({
    where: { student: { id: parseInt(userId) }, status: "confirmed" },
    relations: ["course", "course.category", "student", "teacher"]
  });

  const userTimeZone = req.user.timezone || "Asia/Riyadh";
  const today = DateTime.now().setZone(userTimeZone).toFormat("yyyy-MM-dd");

  const formattedBookings = acceptedRequests.map((sub) => {
    const booking = { ...sub };
    if (booking.sessions && Array.isArray(booking.sessions)) {
      booking.sessions = booking.sessions.map((session) => {
        const dt = DateTime.fromJSDate(new Date(session.utcDateAndTime), { zone: "utc" })
                   .setZone(userTimeZone).setLocale('ar');
        return {
          ...session,
          displayDate: dt.toFormat("yyyy-MM-dd"),
          displayTime: dt.toFormat("hh:mm a"),
          displayDay: dt.toFormat("cccc"),   
          zoomLink: booking.teacher?.zoom_link,
          isToday: dt.toFormat("yyyy-MM-dd") === today 
        };
      });
    }
    return booking;
  });

  res.render("dashboard/student/my-sessions", { title: "حصصي المجدولة", bookings: formattedBookings });
};

const getStudentSettings = async (req, res, next) => {
  const userRepository = AppDataSource.getRepository('User');
  const user = await userRepository.findOne({ where: { id: req.user.id || req.user._id } });
  res.render("dashboard/student/settings", { title: "الاعدادات الطالب", newuser: user });
};

const getStudentBillingPage = async (req, res) => {
    try {
        const studentId = req.user.id || req.user._id;
        const subscriptionRepository = AppDataSource.getRepository('Subscription');
        
        const subscriptions = await subscriptionRepository.find({
            where: { student: { id: parseInt(studentId) } },
            relations: ["course"],
            order: { createdAt: 'DESC' }
        });

        const billingData = subscriptions.map(sub => {
            const startDate = new Date(sub.startDate || sub.createdAt);
            const remainingSessionsCount = (sub.sessions || []).filter(s => s.status !== "completed").length;
            
            return {
                courseName: sub.course?.title,
                totalSessions: sub.numberOfSessionsPerMonth,
                priceOption: sub.selectedPriceOption,
                totalAmount: sub.totalAmount,
                status: sub.status,
                createdAt: sub.createdAt,
                startDate: sub.startDate,
                remainingSessionsCount,
                renewalDate: new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000)
            };
        });

        res.render('dashboard/student/billing', { billingData, activePlan: billingData[0] || null });
    } catch (error) {
        res.status(500).send("حدث خطأ في جلب بيانات الرصيد");
    }
};

const getProfilePage = async (req, res) => { res.render('dashboard/student/profile_tab', {}); };

const getStudentProfilePage = async (req, res) => {
    try {
        const studentId = req.params.id;
        const userRepository = AppDataSource.getRepository('User');
        const subscriptionRepository = AppDataSource.getRepository('Subscription');

        const student = await userRepository.findOne({ where: { id: parseInt(studentId) } });
        if (!student) return res.status(404).send('الطالب غير موجود');

        const subscriptions = await subscriptionRepository.find({ 
            where: { student: { id: parseInt(studentId) } },
            relations: ["course", "teacher"]
        });

        let allSessions = [];
        subscriptions.forEach(sub => {
            (sub.sessions || []).forEach(session => {
                allSessions.push({
                    courseName: sub.course ? sub.course.title : 'كورس غير مسمى',
                    teacherName: sub.teacher ? sub.teacher.name : 'غير محدد',
                    date: session.date,
                    time: session.time,
                    status: session.status,
                    report: session.report,
                    link: sub.teacher?.zoom_link
                });
            });
        });

        allSessions.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.render('dashboard/student_profile', {
            student,
            subscriptions,
            allSessions,
            initials: student.name ? student.name.charAt(0) : 'S'
        });
    } catch (error) {
        res.status(500).send('حدث خطأ في السيرفر');
    }
};

const updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const userRepository = AppDataSource.getRepository('User');
        const user = await userRepository.findOne({ where: { id: req.user.id || req.user._id } });

        if (!currentPassword || !newPassword || !confirmPassword) return res.status(400).json({ success: false, message: "يرجى ملء كافة الحقول." });
        if (newPassword !== confirmPassword) return res.status(400).json({ success: false, message: "غير متطابقين." });
        if (newPassword.length < 6) return res.status(400).json({ success: false, message: "6 أحرف على الأقل." });
        
        if (!(await bcrypt.compare(currentPassword, user.password))) return res.status(400).json({ success: false, message: "كلمة المرور الحالية غير صحيحة." });

        user.password = await bcrypt.hash(newPassword, 10);
        await userRepository.save(user);

        res.status(200).json({ success: true, message: "تم تغيير كلمة المرور بنجاح." });
    } catch (err) {
        res.status(500).json({ success: false, message: "حدث خطأ." });
    }
};

const getStudentSessionsPageParams = async (req, res) => {
    const userId = req.params.id;
    const subscriptionRepository = AppDataSource.getRepository('Subscription');
    const acceptedRequests = await subscriptionRepository.find({
      where: { student: { id: parseInt(userId) }, status: "confirmed" },
      relations: ["course", "course.category", "student", "teacher"]
    });
  
    const userTimeZone = req.user.timezone || "Asia/Riyadh";
    const today = DateTime.now().setZone(userTimeZone).toFormat("yyyy-MM-dd");
  
    const formattedBookings = acceptedRequests.map((sub) => {
      const booking = { ...sub };
      if (booking.sessions && Array.isArray(booking.sessions)) {
        booking.sessions = booking.sessions.map((session) => {
          const dt = DateTime.fromJSDate(new Date(session.utcDateAndTime), { zone: "utc" })
                     .setZone(userTimeZone).setLocale('ar');
          return {
            ...session,
            displayDate: dt.toFormat("yyyy-MM-dd"),
            displayTime: dt.toFormat("hh:mm a"),
            displayDay: dt.toFormat("cccc"),   
            zoomLink: booking.teacher?.zoom_link,
            isToday: dt.toFormat("yyyy-MM-dd") === today 
          };
        });
      }
      return booking;
    });
  
    res.render("dashboard/student/my-sessions", { title: "حصصي المجدولة", bookings: formattedBookings });
  };

module.exports = {
  getStudentProfilePage,
  getStudentSessionsPage: getStudentSessionsPageParams,
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
  getNearestSession, 
  addStudent,
  toggleStatus,
  deleteStudent,
  getAllCoursesForAdminAutoSubscription,
  getAutoAdminBookPlan,
  debugExpireSubscription: async (req, res) => {
      try {
        const subscriptionRepository = AppDataSource.getRepository('Subscription');
        const sub = await subscriptionRepository.findOne({ 
            where: { student: { id: req.user.id || req.user._id }, status: 'confirmed' },
            order: { createdAt: 'DESC' }
        });
        if (sub) {
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 28);
            sub.startDate = oldDate;
            if (sub.sessions && sub.sessions.length > 2) {
                for(let i=0; i<sub.sessions.length-1; i++) {
                    sub.sessions[i].status = 'completed';
                }
            }
            await subscriptionRepository.save(sub);
            res.redirect('/student/enrolled_subscription');
        } else {
            res.send('No confirmed subscription found to expire.');
        }
      } catch (err) {
          res.send('Error expiring subscription');
      }
  }
};
