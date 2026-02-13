const User = require('../models/user_model');
const Subscription = require('../models/subscription_model');
const bcrypt = require('bcryptjs');
const { DateTime } = require('luxon');

// ────────────────────────────────────────────
// Helper: get teacher IDs assigned to this supervisor
// ────────────────────────────────────────────
async function getAssignedTeacherIds(supervisorId) {
    const teachers = await User.find({ role: 'teacher', supervisorId: supervisorId }).select('_id');
    return teachers.map(t => t._id);
}

// ────────────────────────────────────────────
// 1. Supervisor Dashboard (Home)
// ────────────────────────────────────────────
const supervisorDashboard = async (req, res) => {
    try {
        const supervisorId = req.user._id;

        // Get assigned teachers
        const teachers = await User.find({ role: 'teacher', supervisorId: supervisorId }).select('name email phone_number');
        const teacherIds = teachers.map(t => t._id);

        // Get subscriptions for those teachers
        const subscriptions = await Subscription.find({
            teacherId: { $in: teacherIds },
            status: 'confirmed'
        })
        .populate('studentId', 'name')
        .populate('courseId', 'title')
        .populate('teacherId', 'name');

        // Unique students
        const uniqueStudentIds = new Set();
        subscriptions.forEach(sub => {
            if (sub.studentId) uniqueStudentIds.add(sub.studentId._id.toString());
        });

        // Upcoming sessions (next 7 days)
        const now = DateTime.now();
        const weekLater = now.plus({ days: 7 });
        let upcomingSessions = [];

        subscriptions.forEach(sub => {
            if (!sub.sessions) return;
            sub.sessions.forEach(session => {
                if (!session.utcDateAndTime) return;
                const sessionTime = DateTime.fromISO(session.utcDateAndTime);
                if (sessionTime >= now && sessionTime <= weekLater && session.status !== 'completed' && session.status !== 'missed') {
                    upcomingSessions.push({
                        studentName: sub.studentId ? sub.studentId.name : 'غير معروف',
                        teacherName: sub.teacherId ? sub.teacherId.name : 'غير محدد',
                        courseTitle: sub.courseId ? sub.courseId.title : 'غير معروف',
                        displayDate: sessionTime.setZone('Asia/Riyadh').toFormat('yyyy-MM-dd'),
                        displayTime: sessionTime.setZone('Asia/Riyadh').toFormat('hh:mm a'),
                    });
                }
            });
        });

        upcomingSessions.sort((a, b) => {
            return DateTime.fromFormat(a.displayDate + ' ' + a.displayTime, 'yyyy-MM-dd hh:mm a')
                 - DateTime.fromFormat(b.displayDate + ' ' + b.displayTime, 'yyyy-MM-dd hh:mm a');
        });

        const stats = {
            teachersCount: teachers.length,
            studentsCount: uniqueStudentIds.size,
            subscriptionsCount: subscriptions.length,
            upcomingSessionsCount: upcomingSessions.length
        };

        res.render('dashboard/supervisor/supervisor_dashboard', {
            title: 'لوحة تحكم المشرف',
            user: req.user,
            stats,
            teachers,
            upcomingSessions: upcomingSessions.slice(0, 5)
        });
    } catch (error) {
        console.error("Supervisor Dashboard Error:", error);
        res.status(500).render('error', { message: "حدث خطأ أثناء تحميل لوحة التحكم" });
    }
};

// ────────────────────────────────────────────
// 2. Supervisor Teachers Page
// ────────────────────────────────────────────
const supervisorTeachers = async (req, res) => {
    try {
        const supervisorId = req.user._id;
        const teachers = await User.find({ role: 'teacher', supervisorId: supervisorId }).sort({ createdAt: -1 });

        res.render('dashboard/supervisor/supervisor_teachers', {
            title: 'المعلمون التابعون',
            user: req.user,
            teachers
        });
    } catch (error) {
        console.error("Supervisor Teachers Error:", error);
        res.status(500).send("خطأ في السيرفر");
    }
};

// ────────────────────────────────────────────
// 3. Supervisor Students Page
// ────────────────────────────────────────────
const supervisorStudents = async (req, res) => {
    try {
        const supervisorId = req.user._id;
        const teacherIds = await getAssignedTeacherIds(supervisorId);

        // Get subscriptions for those teachers
        const subscriptions = await Subscription.find({
            teacherId: { $in: teacherIds },
            status: { $in: ['confirmed', 'completed'] }
        })
        .populate('studentId', 'name email phone_number')
        .populate('courseId', 'title')
        .populate('teacherId', 'name');

        // Group students with their subscriptions
        const studentMap = {};
        subscriptions.forEach(sub => {
            if (!sub.studentId) return;
            const sid = sub.studentId._id.toString();
            if (!studentMap[sid]) {
                studentMap[sid] = {
                    student: sub.studentId,
                    subscriptions: []
                };
            }
            studentMap[sid].subscriptions.push({
                courseTitle: sub.courseId ? sub.courseId.title : 'غير معروف',
                teacherName: sub.teacherId ? sub.teacherId.name : 'غير محدد',
                status: sub.status,
                sessionsCount: sub.sessions ? sub.sessions.length : 0,
                completedSessions: sub.sessions ? sub.sessions.filter(s => s.status === 'completed').length : 0
            });
        });

        const students = Object.values(studentMap);

        res.render('dashboard/supervisor/supervisor_students', {
            title: 'الطلاب التابعون',
            user: req.user,
            students
        });
    } catch (error) {
        console.error("Supervisor Students Error:", error);
        res.status(500).send("خطأ في السيرفر");
    }
};

// ────────────────────────────────────────────
// 4. Supervisor Sessions Page
// ────────────────────────────────────────────
const supervisorSessions = async (req, res) => {
    try {
        const supervisorId = req.user._id;
        const teacherIds = await getAssignedTeacherIds(supervisorId);

        let startDate = req.query.from ? DateTime.fromISO(req.query.from).startOf('day') : DateTime.now().startOf('day');
        let endDate = req.query.to ? DateTime.fromISO(req.query.to).endOf('day') : DateTime.now().endOf('day');

        if (!startDate.isValid) startDate = DateTime.now().startOf('day');
        if (!endDate.isValid) endDate = DateTime.now().endOf('day');

        const subscriptions = await Subscription.find({
            teacherId: { $in: teacherIds },
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
                if (sessionTime >= startDate && sessionTime <= endDate && session.status !== 'completed' && session.status !== 'missed') {
                    if (!sub.studentId) return;
                    upcomingSessions.push({
                        sessionId: session._id,
                        subscriptionId: sub._id,
                        studentName: sub.studentId.name || 'طالب بدون اسم',
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

        upcomingSessions.sort((a, b) => DateTime.fromISO(a.utcDate) - DateTime.fromISO(b.utcDate));

        res.render('dashboard/supervisor/supervisor_sessions', {
            title: 'الجلسات القادمة',
            sessions: upcomingSessions,
            user: req.user,
            filters: {
                from: startDate.toFormat('yyyy-MM-dd'),
                to: endDate.toFormat('yyyy-MM-dd')
            }
        });
    } catch (error) {
        console.error("Supervisor Sessions Error:", error);
        res.status(500).send("خطأ في السيرفر");
    }
};

// ────────────────────────────────────────────
// 5. Supervisor Messages Page
// ────────────────────────────────────────────
const supervisorMessages = async (req, res) => {
    try {
        res.render('dashboard/supervisor/supervisor_messages', {
            title: 'الرسائل',
            user: req.user
        });
    } catch (error) {
        console.error("Supervisor Messages Error:", error);
        res.status(500).send("خطأ في السيرفر");
    }
};

// ────────────────────────────────────────────
// 6. Supervisor Settings Page
// ────────────────────────────────────────────
const supervisorSettings = async (req, res) => {
    try {
        res.render('dashboard/supervisor/supervisor_settings', {
            title: 'الإعدادات',
            user: req.user
        });
    } catch (error) {
        console.error("Supervisor Settings Error:", error);
        res.status(500).send("خطأ في السيرفر");
    }
};

// ────────────────────────────────────────────
// 7. Update Supervisor Password
// ────────────────────────────────────────────
const updateSupervisorPassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const user = await User.findById(req.user._id);

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: "كلمة المرور الجديدة وتأكيدها غير متطابقين." });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: "يجب أن تكون كلمة المرور 6 أحرف على الأقل." });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "كلمة المرور الحالية غير صحيحة." });
        }

        user.password = newPassword;
        await user.save();

        res.status(200).json({ success: true, message: "تم تغيير كلمة المرور بنجاح." });
    } catch (err) {
        console.error("Update Password Error:", err);
        return res.status(500).json({ success: false, message: "حدث خطأ في السيرفر." });
    }
};

// ────────────────────────────────────────────
// 8. Update Supervisor Profile
// ────────────────────────────────────────────
const updateSupervisorProfile = async (req, res) => {
    try {
        const { name, phone_number } = req.body;
        const updated = await User.findByIdAndUpdate(req.user._id, { name, phone_number }, { new: true });
        if (!updated) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
        res.json({ success: true, message: "تم تحديث البيانات بنجاح" });
    } catch (error) {
        res.status(500).json({ success: false, message: "خطأ في السيرفر" });
    }
};

// ────────────────────────────────────────────
// 9. Teacher Detail Page (Scoped)
// ────────────────────────────────────────────
const getTeacherDetails = async (req, res) => {
    try {
        const supervisorId = req.user._id;
        const teacherId = req.params.id;

        // Verify the teacher belongs to this supervisor
        const teacher = await User.findOne({ _id: teacherId, supervisorId: supervisorId });
        if (!teacher) return res.status(403).send("غير مسموح لك بالدخول، هذا المعلم لا يتبع لإشرافك");

        const teacherHourlyRateDefault = Number(teacher.hour_rate) || (teacher.hourly_rates && teacher.hourly_rates.length > 0 ? teacher.hourly_rates[0].rate : 0);

        const allSubscriptions = await Subscription.find({ teacherId: teacherId })
          .populate("studentId")
          .populate("courseId")
          .lean();

        let totalPendingEarnings = 0;
        let completedSessionsCountAll = 0;
        let totalRemainingAll = 0;

        const studentsMap = {};

        allSubscriptions.forEach((sub) => {
          const student = sub.studentId;
          if (!student) return;

          const studentId = student._id.toString();

          const actualCompleted = sub.sessions ? sub.sessions.filter((s) => s.status === "completed").length : 0;
          const unpaidCompleted = sub.sessions ? sub.sessions.filter((s) => s.status === "completed" && s.isPaidByAdmin !== true).length : 0;
          const totalPlanned = sub.sessions ? sub.sessions.length : 0;
          const remaining = Math.max(0, totalPlanned - actualCompleted);
          
          const duration = Number(sub.selectedPriceOption) || 60;
          const rateToUse = sub.teacherHourlyRate || teacherHourlyRateDefault;
          const subPendingEarnings = unpaidCompleted * (rateToUse * (duration / 60));

          totalPendingEarnings += subPendingEarnings;
          completedSessionsCountAll += actualCompleted;
          totalRemainingAll += remaining;

          if (studentsMap[studentId]) {
            studentsMap[studentId].courses.push(sub.courseId?.title || "كورس غير محدد");
            studentsMap[studentId].totalSessions += totalPlanned;
            studentsMap[studentId].completedSessions += actualCompleted;
            studentsMap[studentId].remainingSessions += remaining;
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

        const processedStudents = Object.values(studentsMap);

        res.render("dashboard/supervisor/supervisor_teacher_details", {
          teacher,
          user: req.user,
          title: `تفاصيل المعلم | ${teacher.name}`,
          students: processedStudents,
          stats: {
            totalStudents: processedStudents.length,
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

// ────────────────────────────────────────────
// 10. Teacher Schedule Page (Scoped)
// ────────────────────────────────────────────
function fromUTC(utcDate, timeZone) {
    const dt = DateTime.fromISO(utcDate, { zone: "utc" }).setZone(timeZone || "Asia/Riyadh");
    return {
      date: dt.toFormat("yyyy-MM-dd"),
      time: dt.toFormat("HH:mm"),
    };
}

const getTeacherSchedule = async (req, res) => {
    try {
        const supervisorId = req.user._id;
        const teacherId = req.params.id;

        const teacher = await User.findOne({ _id: teacherId, supervisorId: supervisorId });
        if (!teacher) return res.status(403).send("غير مسموح لك بالدخول، هذا المعلم لا يتبع لإشرافك");

        const now = new Date();
        const dayOfWeek = now.getDay();
        const diffToSaturday = dayOfWeek === 6 ? 0 : -(dayOfWeek + 1);

        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() + diffToSaturday);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const bookings = await Subscription.find({ teacherId: teacherId })
          .populate("studentId", "name")
          .populate("courseId", "title");

        let weeklySchedule = {};

        bookings.forEach((booking) => {
          booking.sessions.forEach((session, index) => {
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

              const result = fromUTC(session.utcDateAndTime, teacher.timezone);
              
              weeklySchedule[dateKey].sessions.push({
                date: result.date,
                time: result.time,
                fullUTC: session.utcDateAndTime,
                studentName: booking.studentId?.name,
                courseTitle: booking.courseId?.title,
                status: session.status,
                bookingId: booking._id,
                sessionIndex: index,
              });
            }
          });
        });

        Object.keys(weeklySchedule).forEach((date) => {
          weeklySchedule[date].sessions.sort((a, b) =>
            a.time.localeCompare(b.time)
          );
        });

        const sortedSchedule = Object.keys(weeklySchedule)
          .sort()
          .reduce((obj, key) => {
            obj[key] = weeklySchedule[key];
            return obj;
          }, {});

        res.render("dashboard/supervisor/supervisor_teacher_schedule", {
          schedule: sortedSchedule,
          teacherName: teacher.name,
          user: req.user,
          teacher: teacher,
          title: `جدول المعلم | ${teacher.name}`
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("خطأ في جلب الجدول");
    }
};

// ────────────────────────────────────────────
// 11. Student Profile Page (Scoped)
// ────────────────────────────────────────────
const getStudentProfile = async (req, res) => {
    try {
        const supervisorId = req.user._id;
        const studentId = req.params.id;
        const teacherIds = await getAssignedTeacherIds(supervisorId);

        // Verify the student is associated with at least one teacher of this supervisor
        const student = await User.findById(studentId);
        if (!student) return res.status(404).send('الطالب غير موجود');

        // Check if there's an active subscription with any of the assigned teachers
        const hasAccess = await Subscription.exists({
            studentId: studentId,
            teacherId: { $in: teacherIds }
        });

        if (!hasAccess) return res.status(403).send('غير مسموح لك بالدخول لملف هذا الطالب');

        const subscriptions = await Subscription.find({ 
            studentId: studentId,
            teacherId: { $in: teacherIds }
        })
        .populate('courseId')
        .populate('teacherId');

        let allSessions = [];
        subscriptions.forEach(sub => {
            sub.sessions.forEach(session => {
                allSessions.push({
                    courseName: sub.courseId ? sub.courseId.title : 'كورس غير مسمى',
                    teacherName: sub.teacherId ? sub.teacherId.name : 'غير محدد',
                    date: session.date,
                    time: session.time,
                    status: session.status,
                    report: session.report,
                    link: sub.teacherId ? sub.teacherId.zoom_link : '#'
                });
            });
        });

        allSessions.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.render('dashboard/supervisor/supervisor_student_profile', {
            student: student,
            user: req.user,
            title: `ملف الطالب | ${student.name}`,
            subscriptions: subscriptions,
            allSessions: allSessions,
            initials: student.name ? student.name.charAt(0) : 'S'
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('حدث خطأ في السيرفر');
    }
};

module.exports = {
    supervisorDashboard,
    supervisorTeachers,
    supervisorStudents,
    supervisorSessions,
    supervisorMessages,
    supervisorSettings,
    updateSupervisorPassword,
    updateSupervisorProfile,
    getTeacherDetails,
    getTeacherSchedule,
    getStudentProfile
};
