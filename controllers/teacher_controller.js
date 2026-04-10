const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { DateTime } = require("luxon");
const { AppDataSource } = require('../config/database');

const maxAge = 3 * 24 * 60 * 60;
const createToken = (id) => jwt.sign({ id }, "01115699209", { expiresIn: maxAge });

function fromUTC(utcDate, timeZone) {
  const dt = DateTime.fromISO(utcDate, { zone: "utc" }).setZone(timeZone || "Asia/Riyadh");
  return { date: dt.toFormat("yyyy-MM-dd"), time: dt.toFormat("HH:mm") };
}

function extractDateTime(utcDate, timeZone) { return fromUTC(utcDate, timeZone); }

const teacherStatics = async (req, res) => {
  try {
    const teacherId = req.user.id || req.user._id;
    const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
    const subscriptionRepository = AppDataSource.getRepository('Subscription');

    const totalStudentsCount = await subscriptionRepository.count({ where: { teacher: { id: parseInt(teacherId) }, academy: { id: parseInt(academyId) } } });
    
    let hourly_rates = req.user.hourly_rates || [];
    const teacherHourlyRateDefault = Number(req.user.hour_rate) || (hourly_rates.length > 0 ? hourly_rates[0].rate : 0);

    const bookings = await subscriptionRepository.find({
      where: { teacher: { id: parseInt(teacherId) }, academy: { id: parseInt(academyId) } },
      relations: ["student", "course"]
    });

    let completedSessions = [];
    const monthlyStats = {};

    bookings.forEach((booking) => {
      if(!booking.sessions) return;
      booking.sessions.forEach((session) => {
        if (session.status === "completed" && session.attended) {
          const durationInMinutes = Number(booking.selectedPriceOption) || 60;
          const rateToUse = booking.teacherHourlyRate || teacherHourlyRateDefault;
          const sessionPrice = rateToUse * (durationInMinutes / 60);

          const sessionDate = new Date(session.date);
          const monthNum = sessionDate.getMonth() + 1; 

          completedSessions.push({
            date: session.date,
            time: session.time,
            studentName: booking.student?.name || "طالب محذوف",
            courseTitle: booking.course?.title || "كورس محذوف",
            price: sessionPrice,
            duration: durationInMinutes,
            month: monthNum,
          });

          if (!monthlyStats[monthNum]) {
            const monthName = new Intl.DateTimeFormat("ar-EG", { month: "long" }).format(sessionDate);
            monthlyStats[monthNum] = { monthName: monthName, total: 0, count: 0 };
          }
          monthlyStats[monthNum].total += sessionPrice;
          monthlyStats[monthNum].count += 1;
        }
      });
    });

    completedSessions.sort((a, b) => new Date(b.date) - new Date(a.date));
    const totalEarnings = completedSessions.reduce((sum, s) => sum + s.price, 0);

    const latestBookings = await subscriptionRepository.find({ 
        where: { teacher: { id: parseInt(teacherId) }, academy: { id: parseInt(academyId) } },
        relations: ["student", "course"],
        order: { createdAt: 'DESC' },
        take: 5
    });

    return { students: totalStudentsCount, revenue: totalEarnings, courses: 1, rating: 4.9, latestStudents: latestBookings };
  } catch (err) {
    return null;
  }
};

const teacherHome = async (req, res) => {
  try {
    const teacherId = req.user.id || req.user._id;
    const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
    const subscriptionRepository = AppDataSource.getRepository('Subscription');

    const teacherStatic = await teacherStatics(req, res);
    
    const bookings = await subscriptionRepository.find({
      where: { teacher: { id: parseInt(teacherId) }, academy: { id: parseInt(academyId) } },
      relations: ["student", "course"]
    });

    let todaysSessions = [];
    bookings.forEach((booking) => {
      (booking.sessions || []).forEach((session, index) => {
        if (new Date(session.date).toDateString() === new Date().toDateString()) {
          const [hours, minutes] = session.time.split(":").map(Number);
          const sessionStart = new Date().setHours(hours, minutes - 10, 0);
          const sessionEnd = new Date().setHours(hours + 1, minutes, 0);
          const currentTime = new Date().getTime();

          let status = "upcoming";
          if (currentTime >= sessionStart && currentTime <= sessionEnd) status = "live";
          else if (currentTime > sessionEnd) status = "finished";
          
          const result = extractDateTime(session.utcDateAndTime, req.user.timezone || 'Asia/Riyadh');
          todaysSessions.push({
            bookingId: booking.id, 
            sessionIndex: index, 
            title: booking.course?.title,
            studentName: booking.student?.name,
            time: result.time,
            date: result.date,
            status: status,
            isSendReport: session.report && session.report.level != null,
            link: req.user.zoom_link || booking.zoomLink || "#",
          });
        }
      });
    });

    todaysSessions.sort((a, b) => a.time.localeCompare(b.time));
    res.render("../views/dashboard/teacher/teacher_dashboard", {
      todaysSessions, todaysSessionsNumbers: todaysSessions.length, teacherStatic,
      currentDate: new Date().toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" }),
    });
  } catch (err) {
    res.status(500).send("خطأ في تحميل الصفحة الرئيسية");
  }
};

const signup_get = (req, res) => res.render("../views/dashboard/teacher/teacher_register");
const login_get = (req, res) => res.render("../views/dashboard/login");
const changePasswordPage = async (req, res) => res.render("../views/dashboard/teacher/teacher_change_password.ejs", { user: req.user, settings: req.settings || {}, currentLang: "ar", dir: "rtl" });
const settings_page = (req, res) => res.render("../views/dashboard/teacher/teacher_settings.ejs", { teacher: req.user });

const registerTeacher = async (req, res) => {
  const { name, email, country_code, phone_number, gender, password, confirm_password, zoom_link, timezone } = req.body;
  const normalizedEmail = email ? email.trim().toLowerCase() : '';
  try {
    const userRepository = AppDataSource.getRepository('User');
    if (await userRepository.findOne({ where: { email: normalizedEmail } })) {
      return res.status(400).json({ error: "هذا البريد الإلكتروني مسجل بالفعل." });
    }
    if (password.length < 6) return res.status(400).json({ error: "كلمة المرور ضعيفة." });
    if (password !== confirm_password) return res.status(400).json({ error: "كلمتا المرور غير متطابقتين." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = userRepository.create({
      name, email: normalizedEmail, country_code, phone_number: country_code + phone_number,
      role: "teacher", password: hashedPassword, gender, zoom_link, timezone
    });
    await userRepository.save(user);

    res.status(200).json({ message: "تم التسجيل بنجاح." });
  } catch (err) {
    res.status(400).json({ error: "حدث خطأ غير متوقع أثناء التسجيل." });
  }
};

const loginTeacher = async (req, res) => {
  const { email, password, role } = req.body;
  const normalizedEmail = email ? email.trim().toLowerCase() : '';
  try {
    const userRepository = AppDataSource.getRepository('User');
    const user = await userRepository.findOne({ where: { email: normalizedEmail, role } });

    if (!user) return res.status(400).json({ errors: { email: "هذا البريد الإلكتروني غير صحيح" } });
    if (!(await bcrypt.compare(password, user.password))) return res.status(400).json({ errors: { password: "كلمة المرور المدخلة غير صحيحة" } });

    const token = createToken(user.id);
    res.cookie("jwt", token, { httpOnly: true, maxAge: maxAge * 1000 });
    res.status(200).json({ user: user.id, message: "تم تسجيل الدخول بنجاح." });
  } catch (err) {
    res.status(500).json({ errors: { general: "خطأ في السيرفر" } });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userRepository = AppDataSource.getRepository('User');
    const user = await userRepository.findOne({ where: { id: req.user.id || req.user._id } });

    if (!user) return res.status(404).json({ message: "المستخدم غير موجود" });
    if (!(await bcrypt.compare(currentPassword, user.password))) return res.status(400).json({ message: "كلمة المرور الحالية غير صحيحة" });
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: "يجب أن تكون 6 أحرف على الأقل" });

    user.password = await bcrypt.hash(newPassword, 10);
    await userRepository.save(user);
    res.status(200).json({ message: "تم تغيير كلمة المرور بنجاح" });
  } catch (err) {
    res.status(500).json({ message: "حدث خطأ أثناء تغيير كلمة المرور" });
  }
};

const postUpdateProfile = async (req, res) => {
  try {
    const { name, zoom_link, bio } = req.body;
    const userRepository = AppDataSource.getRepository('User');
    const subscriptionRepository = AppDataSource.getRepository('Subscription');
    const userId = req.user.id || req.user._id;

    let user = await userRepository.findOne({ where: { id: userId } });
    
    if (zoom_link && zoom_link !== user.zoom_link) {
      const subs = await subscriptionRepository.find({ where: { teacher: { id: userId } } });
      for (const sub of subs) {
          let updated = false;
          if (sub.sessions) {
              sub.sessions.forEach(sess => {
                  if (sess.status === 'pending') { sess.link = zoom_link; updated = true; }
              });
          }
          if (updated) await subscriptionRepository.save(sub);
      }
    }
    
    let updateData = { name, zoom_link, bio };
    if (req.file) updateData.avatar = req.file.filename;

    await userRepository.update(userId, updateData);
    res.redirect("/teacher/home");
  } catch (err) {
    res.status(500).send("حدث خطأ أثناء التحديث");
  }
};

const finanical_page = async (req, res) => {
  try {
    const teacherId = req.user.id || req.user._id;
    const teacherHourlyRateDefault = Number(req.user.hour_rate) || (req.user.hourly_rates && req.user.hourly_rates.length > 0 ? req.user.hourly_rates[0].rate : 0);
    
    const paymentRepository = AppDataSource.getRepository('Payment');
    const subscriptionRepository = AppDataSource.getRepository('Subscription');

    const paymentHistory = await paymentRepository.find({ where: { teacher: { id: parseInt(teacherId) } }, order: { paymentDate: 'DESC' } });
    
    const bookings = await subscriptionRepository.find({ 
        where: { teacher: { id: parseInt(teacherId) } },
        relations: ["student", "course"]
    });

    let completedSessions = [];
    let totalPendingEarnings = 0;
    const monthlyStats = {};

    bookings.forEach((booking) => {
      (booking.sessions || []).forEach((session) => {
        if (session.status === "completed" && session.attended) {
          const duration = Number(booking.selectedPriceOption) || 60;
          const rateToUse = booking.teacherHourlyRate || teacherHourlyRateDefault;
          const sessionPrice = rateToUse * (duration / 60);

          const sessionDate = new Date(session.date);
          const monthKey = `${sessionDate.getFullYear()}-${sessionDate.getMonth() + 1}`;

          completedSessions.push({
            ...session, price: sessionPrice, courseTitle: booking.course?.title,
            studentName: booking.student?.name, sessionDuration: duration, monthKey, isPaid: session.isPaidByAdmin
          });

          if (!session.isPaidByAdmin) totalPendingEarnings += sessionPrice;

          if (!monthlyStats[monthKey]) monthlyStats[monthKey] = {
              name: new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric" }).format(sessionDate),
              total: 0, isPaid: true
          };
          monthlyStats[monthKey].total += sessionPrice;
          if (!session.isPaidByAdmin) monthlyStats[monthKey].isPaid = false;
        }
      });
    });

    res.render("../views/dashboard/teacher/teacher_financial.ejs", {
      teacherName: req.user.name, hourlyRate: teacherHourlyRateDefault,
      totalEarnings: totalPendingEarnings.toFixed(2), monthlyStats, completedSessions, paymentHistory
    });
  } catch (err) {
    res.status(500).send("خطأ في معالجة البيانات المالية");
  }
};

const getAdminTeacherFinancial = async (req, res) => {
  try {
    const teacherId = req.params.id;
    const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
    const userRepository = AppDataSource.getRepository('User');
    const subscriptionRepository = AppDataSource.getRepository('Subscription');

    const teacher = await userRepository.findOne({ where: { id: parseInt(teacherId), academy: { id: parseInt(academyId) } } });
    if (!teacher) return res.status(404).send("المعلم غير موجود");

    const teacherHourlyRateDefault = Number(teacher.hour_rate) || (teacher.hourly_rates && teacher.hourly_rates.length > 0 ? teacher.hourly_rates[0].rate : 0);

    const bookings = await subscriptionRepository.find({
      where: { teacher: { id: parseInt(teacherId) }, academy: { id: parseInt(academyId) } },
      relations: ["student", "course"]
    });

    let unpaidSessions = [];
    let paidSessionsGrouped = {};
    const monthlyStats = {};

    bookings.forEach((booking) => {
      (booking.sessions || []).forEach((session) => {
        if (session.status === "completed") {
          const duration = Number(booking.selectedPriceOption) || 60;
          const rateToUse = booking.teacherHourlyRate || teacherHourlyRateDefault;
          const sessionPrice = rateToUse * (duration / 60);
          const sessionDate = new Date(session.date);
          const monthKey = `${sessionDate.getFullYear()}-${sessionDate.getMonth() + 1}`;
          const monthNameDisplay = new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric" }).format(sessionDate);

          const sessionInfo = {
            date: session.date, studentName: booking.student?.name || "طالب محذوف",
            courseTitle: booking.course?.title || "كورس محذوف", price: sessionPrice.toFixed(2), duration
          };

          if (session.isPaidByAdmin) {
            if (!paidSessionsGrouped[monthKey]) paidSessionsGrouped[monthKey] = { name: monthNameDisplay, sessions: [], totalPaidInMonth: 0 };
            paidSessionsGrouped[monthKey].sessions.push(sessionInfo);
            paidSessionsGrouped[monthKey].totalPaidInMonth += sessionPrice; 
          } else {
            unpaidSessions.push(sessionInfo);
            if (!monthlyStats[monthKey]) monthlyStats[monthKey] = { monthName: monthNameDisplay, total: 0, count: 0, key: monthKey };
            monthlyStats[monthKey].total += sessionPrice;
            monthlyStats[monthKey].count += 1;
          }
        }
      });
    });

    const totalUnpaid = unpaidSessions.reduce((sum, s) => sum + parseFloat(s.price), 0);
    res.render("dashboard/teacher-financial-report", { teacher, unpaidSessions, paidSessionsGrouped, monthlyStats, totalUnpaid: totalUnpaid.toFixed(2) });
  } catch (err) {
    res.status(500).send("خطأ في جلب البيانات المالية");
  }
};

const processTeacherSalary = async (req, res) => {
  try {
    const { teacherId, monthKey, amount } = req.body;
    const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
    const paymentRepository = AppDataSource.getRepository('Payment');
    const subscriptionRepository = AppDataSource.getRepository('Subscription');

    const newPayment = paymentRepository.create({
      type: 'expense', category: 'salary', teacher: { id: parseInt(teacherId) },
      toUser: teacherId, amount: parseFloat(amount), month: monthKey, paymentDate: new Date(),
      adminId: req.user.id || req.user._id, academy: { id: parseInt(academyId) },
      status: "completed", description: `راتب المعلم لشهر ${monthKey}`
    });
    await paymentRepository.save(newPayment);

    const subscriptions = await subscriptionRepository.find({ where: { teacher: { id: parseInt(teacherId) }, academy: { id: parseInt(academyId) } } });
    for (let sub of subscriptions) {
      let hasChanged = false;
      if (sub.sessions) {
          sub.sessions.forEach((session) => {
            if (session.status === "completed" && !session.isPaidByAdmin) {
              const sessionDate = new Date(session.date);
              const sessionMonthKey = `${sessionDate.getFullYear()}-${sessionDate.getMonth() + 1}`;
              if (sessionMonthKey === monthKey) { session.isPaidByAdmin = true; hasChanged = true; }
            }
          });
          if (hasChanged) await subscriptionRepository.save(sub);
      }
    }
    res.status(200).json({ message: "تم التحديث بنجاح" });
  } catch (error) {
    res.status(500).json({ error: "فشل في المعالجة" });
  }
};

const updateTeacherStatus = async (req, res) => {
  try {
    const { teacherId, isActive } = req.body;
    const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
    const userRepository = AppDataSource.getRepository('User');
    const subscriptionRepository = AppDataSource.getRepository('Subscription');

    if (isActive === false) {
      const subs = await subscriptionRepository.find({ where: { teacher: { id: parseInt(teacherId) } } });
      const hasUnpaid = subs.some(sub => sub.sessions && sub.sessions.some(s => s.status === 'completed' && !s.isPaidByAdmin));
      if (hasUnpaid) return res.status(400).json({ success: false, error: "يوجد حصص منجزة لم يتم دفع مستحقاتها." });
    }

    const updated = await userRepository.update({ id: parseInt(teacherId), academy: { id: parseInt(academyId) } }, { status: isActive ? 'active' : 'archived' });
    if (updated.affected === 0) return res.status(404).json({ success: false, error: "المعلم غير موجود" });

    res.json({ success: true, message: isActive ? "تم التفعيل" : "تمت الأرشفة" });
  } catch (error) {
    res.status(500).json({ success: false, error: "حدث خطأ" });
  }
};

const deleteTeacher = async (req, res) => {
  try {
    const teacherId = req.params.id;
    const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
    const userRepository = AppDataSource.getRepository('User');
    const subscriptionRepository = AppDataSource.getRepository('Subscription');

    const subs = await subscriptionRepository.find({ where: { teacher: { id: parseInt(teacherId) } } });
    const hasUnpaid = subs.some(sub => sub.sessions && sub.sessions.some(s => s.status === 'completed' && !s.isPaidByAdmin));
    if (hasUnpaid) return res.status(400).json({ success: false, message: "لا يمكن الحذف هناك مبالغ لم تُصرف." });

    const activeSubs = subs.some(sub => sub.status === 'active' || sub.status === 'confirmed');
    if (activeSubs) return res.status(400).json({ success: false, message: "مرتبط باشتراكات طلاب نشطة." });

    const deleted = await userRepository.delete({ id: parseInt(teacherId), academy: { id: parseInt(academyId) } });
    if (deleted.affected === 0) return res.status(404).json({ success: false, message: "المعلم غير موجود" });

    res.json({ success: true, message: "تم حذف المعلم نهائياً" });
  } catch (error) {
    res.status(500).json({ success: false, message: "حدث خطأ" });
  }
};

const getTeacherCalendarPage = async (req, res) => {
  const userRepository = AppDataSource.getRepository('User');
  const teacher = await userRepository.findOne({ where: { id: parseInt(req.params.id) } });
  res.render("../views/dashboard/teacher/teacher_session_table", { teacher });
};

const getTeacherEvents = async (req, res) => {
  try {
    const teacherId = req.params.id;
    const subscriptionRepository = AppDataSource.getRepository('Subscription');
    const bookings = await subscriptionRepository.find({ where: { teacher: { id: parseInt(teacherId) } }, relations: ["student"] });

    let events = [];
    bookings.forEach((booking) => {
      (booking.sessions || []).forEach((session, index) => {
        if (session.date && session.time) {
          events.push({
            bookingId: booking.id, sessionIndex: index, isSendReport: session.report && session.report.level != null,
            title: booking.student?.name || "طالب", start: session.utcDateAndTime, backgroundColor: "#4f46e5",
          });
        }
      });
    });
    res.json(events);
  } catch (err) {
    res.status(500).json([]);
  }
};

const getSchedule = async (req, res) => {
  try {
    const teacherId = req.user.id || req.user._id;
    const subscriptionRepository = AppDataSource.getRepository('Subscription');

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const bookings = await subscriptionRepository.find({ where: { teacher: { id: parseInt(teacherId) } }, relations: ["student", "course"] });

    let weeklySchedule = {};
    bookings.forEach((booking) => {
      (booking.sessions || []).forEach((session, index) => {
        const sessionDate = new Date(session.date);
        if (sessionDate >= startOfWeek && sessionDate <= endOfWeek) {
          const dateKey = sessionDate.toISOString().split("T")[0];
          if (!weeklySchedule[dateKey]) weeklySchedule[dateKey] = { dayName: sessionDate.toLocaleDateString("ar-EG", { weekday: "long" }), dayNumber: sessionDate.getDate(), sessions: [] };
          
          weeklySchedule[dateKey].sessions.push({
            date: fromUTC(session.utcDateAndTime, req.user.timezone).date,
            time: fromUTC(session.utcDateAndTime, req.user.timezone).time,
            fullUTC: session.utcDateAndTime, studentName: booking.student?.name,
            courseTitle: booking.course?.title, status: session.status,
            bookingId: booking.id, sessionIndex: index,
          });
        }
      });
    });

    Object.keys(weeklySchedule).forEach((date) => weeklySchedule[date].sessions.sort((a, b) => a.time.localeCompare(b.time)));
    const sortedSchedule = Object.keys(weeklySchedule).sort().reduce((obj, key) => { obj[key] = weeklySchedule[key]; return obj; }, {});

    res.render("../views/dashboard/teacher/teacher_time_table", { schedule: sortedSchedule, teacherName: req.user.name, user: req.user });
  } catch (err) {
    res.status(500).send("خطأ في جلب الجدول");
  }
};

const getAdminScheduleTeacher = async (req, res) => {
  try {
    const teacherId = req.params.id;
    const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
    const userRepository = AppDataSource.getRepository('User');
    const subscriptionRepository = AppDataSource.getRepository('Subscription');

    const teacher = await userRepository.findOne({ where: { id: parseInt(teacherId), academy: { id: parseInt(academyId) } } });
    if (!teacher) return res.status(404).send("المعلم غير موجود");

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const bookings = await subscriptionRepository.find({ where: { teacher: { id: parseInt(teacherId) } }, relations: ["student", "course"] });

    let weeklySchedule = {};
    bookings.forEach((booking) => {
      (booking.sessions || []).forEach((session, index) => {
        const sessionDate = new Date(session.date);
        if (sessionDate >= startOfWeek && sessionDate <= endOfWeek) {
          const dateKey = sessionDate.toISOString().split("T")[0];
          if (!weeklySchedule[dateKey]) weeklySchedule[dateKey] = { dayName: sessionDate.toLocaleDateString("ar-EG", { weekday: "long" }), dayNumber: sessionDate.getDate(), sessions: [] };
          
          weeklySchedule[dateKey].sessions.push({
            date: fromUTC(session.utcDateAndTime, teacher.timezone).date,
            time: fromUTC(session.utcDateAndTime, teacher.timezone).time,
            fullUTC: session.utcDateAndTime, studentName: booking.student?.name,
            courseTitle: booking.course?.title, status: session.status,
            bookingId: booking.id, sessionIndex: index,
          });
        }
      });
    });

    Object.keys(weeklySchedule).forEach((date) => weeklySchedule[date].sessions.sort((a, b) => a.time.localeCompare(b.time)));
    const sortedSchedule = Object.keys(weeklySchedule).sort().reduce((obj, key) => { obj[key] = weeklySchedule[key]; return obj; }, {});

    res.render("../views/dashboard/teacher/teacher_time_table", { schedule: sortedSchedule, teacherName: teacher.name, user: teacher });
  } catch (err) {
    res.status(500).send("خطأ في جلب الجدول");
  }
};

const getSessionPage = async (req, res) => {
  try {
    const { bookingId, sessionIndex } = req.params;
    const subscriptionRepository = AppDataSource.getRepository('Subscription');
    const booking = await subscriptionRepository.findOne({ where: { id: parseInt(bookingId) }, relations: ["student", "course"] });
    const session = booking.sessions[sessionIndex];

    res.render("../views/dashboard/teacher/teacher_session", { booking, session, sessionIndex, student: booking.student, title: "متابعة الحصة" });
  } catch (err) {
    res.status(500).send("خطأ في الخادم");
  }
};

const saveSessionReport = async (req, res) => {
  try {
    const { bookingId, sessionIndex, level, content, instructions } = req.body;
    const subscriptionRepository = AppDataSource.getRepository('Subscription');

    const booking = await subscriptionRepository.findOne({ where: { id: parseInt(bookingId) } });
    if(booking.sessions && booking.sessions[sessionIndex]) {
        booking.sessions[sessionIndex].status = "completed";
        booking.sessions[sessionIndex].attended = true;
        booking.sessions[sessionIndex].report = { level, content, instructions, submittedAt: new Date() };
        await subscriptionRepository.save(booking);
        res.status(200).json({ success: true, message: "تم حفظ التقرير بنجاح" });
    } else {
        res.status(404).send("الجلسة غير موجودة.");
    }
  } catch (err) {
    res.status(500).send("خطأ في حفظ التقرير");
  }
};

const studentGetpage = async (req, res) => {
  try {
    const teacherId = req.user.id || req.user._id;
    const subscriptionRepository = AppDataSource.getRepository('Subscription');

    const bookings = await subscriptionRepository.find({ where: { teacher: { id: parseInt(teacherId) } }, relations: ["student", "course"] });

    const students = bookings.map((book) => ({
      id: book.student?.id, name: book.student?.name, email: book.student?.email,
      numberOfSessionsPerMonth: book.numberOfSessionsPerMonth,
      courseTitle: book.course?.title || "كورس غير محدد",
      progress: book.progress || 0, isActive: book.status === "confirmed",
      completedSessions: (book.sessions || []).filter((session) => session.status === "completed").length,
    }));

    res.render("../views/dashboard/teacher/teacher_students", { user: req.user, students, settings: req.settings || {}, currentLang: "ar", dir: "rtl" });
  } catch (err) {
    res.status(500).send("حدث خطأ في جلب البيانات");
  }
};

const getStudentProfile = async (req, res) => {
  try {
    const studentId = req.params.id;
    const teacherId = req.user.id || req.user._id;
    const userRepository = AppDataSource.getRepository('User');
    const subscriptionRepository = AppDataSource.getRepository('Subscription');

    const student = await userRepository.findOne({ where: { id: parseInt(studentId) } });
    if (!student) return res.status(404).send("الطالب غير موجود");

    const subscriptions = await subscriptionRepository.find({ where: { student: { id: parseInt(studentId) }, teacher: { id: parseInt(teacherId) } }, relations: ["course", "teacher"] });

    let allSessions = [];
    subscriptions.forEach((sub) => {
      (sub.sessions || []).forEach((session) => {
        allSessions.push({
          courseName: sub.course?.title || "كورس غير مسمى", teacherName: sub.teacher?.name || "غير محدد",
          date: session.date, time: session.time, status: session.status, report: session.report,
        });
      });
    });

    allSessions.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.render("../views/dashboard/teacher/teacher_student_profile", { user: req.user, student, subscriptions, allSessions, initials: student.name ? student.name.charAt(0) : "S", settings: req.settings || {}, currentLang: "ar", dir: "rtl" });
  } catch (err) {
    res.status(500).send("حدث خطأ في جلب البيانات");
  }
};

const getTeacherPage = async (req, res) => {
  try {
    const teacherId = req.params.id;
    const userRepository = AppDataSource.getRepository('User');
    const subscriptionRepository = AppDataSource.getRepository('Subscription');

    const teacher = await userRepository.findOne({ where: { id: parseInt(teacherId) } });
    if (!teacher) return res.status(404).send("المعلم غير موجود");

    const teacherHourlyRateDefault = Number(teacher.hour_rate) || (teacher.hourly_rates && teacher.hourly_rates.length > 0 ? teacher.hourly_rates[0].rate : 0);

    const allSubscriptions = await subscriptionRepository.find({ where: { teacher: { id: parseInt(teacherId) } }, relations: ["student", "course"] });

    let totalPendingEarnings = 0;
    let completedSessionsCountAll = 0;
    let totalRemainingAll = 0;
    const studentsMap = {};

    allSubscriptions.forEach((sub) => {
      const student = sub.student;
      if (!student) return;

      const sid = student.id.toString();
      const actualCompleted = (sub.sessions || []).filter((s) => s.status === "completed").length;
      const unpaidCompleted = (sub.sessions || []).filter((s) => s.status === "completed" && !s.isPaidByAdmin).length;
      const totalPlanned = (sub.sessions || []).length;
      const remaining = Math.max(0, totalPlanned - actualCompleted);
      
      const duration = Number(sub.selectedPriceOption) || 60;
      const rateToUse = sub.teacherHourlyRate || teacherHourlyRateDefault;
      const subPendingEarnings = unpaidCompleted * (rateToUse * (duration / 60));

      totalPendingEarnings += subPendingEarnings;
      completedSessionsCountAll += actualCompleted;
      totalRemainingAll += remaining;

      if (studentsMap[sid]) {
        studentsMap[sid].courses.push(sub.course?.title || "كورس غير محدد");
        studentsMap[sid].totalSessions += totalPlanned;
        studentsMap[sid].completedSessions += actualCompleted;
        studentsMap[sid].remainingSessions += remaining;
        if (remaining > 0) studentsMap[sid].status = "in-progress";
      } else {
        studentsMap[sid] = {
          id: sid, name: student.name || "طالب محذوف", image: student.image, 
          courses: [sub.course?.title || "كورس غير محدد"], totalSessions: totalPlanned,
          completedSessions: actualCompleted, remainingSessions: remaining,
          startDate: sub.startDate ? new Date(sub.startDate).toLocaleDateString("ar-EG") : "غير محدد",
          status: remaining === 0 ? "completed" : "in-progress",
        };
      }
    });

    const processedStudents = Object.values(studentsMap);

    res.render("dashboard/teacher-details.ejs", { teacher, students: processedStudents, stats: { totalStudents: processedStudents.length, totalEarnings: totalPendingEarnings.toFixed(2), completedSessionsCount: completedSessionsCountAll, totalRemainingSessions: totalRemainingAll, }, currentDate: new Date().toLocaleDateString("ar-EG"), });
  } catch (error) {
    res.status(500).send("خطأ في السيرفر");
  }
};

module.exports = {
  getAdminScheduleTeacher, updateTeacherStatus, deleteTeacher, processTeacherSalary, getAdminTeacherFinancial,
  getTeacherPage, teacherStatics, studentGetpage, signup_get, login_get, loginTeacher, registerTeacher,
  teacherHome, getTeacherCalendarPage, settings_page, finanical_page, getSchedule, getTeacherEvents,
  getSessionPage, saveSessionReport, postUpdateProfile, changePasswordPage, changePassword, getStudentProfile,
};
