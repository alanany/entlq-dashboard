const { AppDataSource } = require('../config/database');
const bcrypt = require('bcryptjs');
const { DateTime } = require('luxon');
const { In } = require('typeorm');

// ────────────────────────────────────────────
// Helper: get teacher IDs assigned to this supervisor
// ────────────────────────────────────────────
async function getAssignedTeacherIds(supervisorId) {
    const userRepository = AppDataSource.getRepository('User');
    const teachers = await userRepository.find({ 
        where: { role: 'teacher', supervisor: { id: parseInt(supervisorId) } },
        select: ['id']
    });
    return teachers.map(t => t.id);
}

// ────────────────────────────────────────────
// 1. Supervisor Dashboard (Home)
// ────────────────────────────────────────────
const supervisorDashboard = async (req, res) => {
    try {
        const supervisorId = req.user.id;
        const userRepository = AppDataSource.getRepository('User');
        const subscriptionRepository = AppDataSource.getRepository('Subscription');

        // Get assigned teachers
        const teachers = await userRepository.find({ 
            where: { role: 'teacher', supervisor: { id: parseInt(supervisorId) } },
            select: ['id', 'name', 'email', 'phone_number']
        });
        const teacherIds = teachers.map(t => t.id);

        let subscriptions = [];
        if (teacherIds.length > 0) {
            // Get subscriptions for those teachers
            subscriptions = await subscriptionRepository.find({
                where: {
                    teacher: { id: In(teacherIds) },
                    status: 'confirmed'
                },
                relations: ['student', 'course', 'teacher']
            });
        }

        // Unique students
        const uniqueStudentIds = new Set();
        subscriptions.forEach(sub => {
            if (sub.student) uniqueStudentIds.add(sub.student.id.toString());
        });

        // Upcoming sessions (next 7 days)
        const now = DateTime.now();
        const weekLater = now.plus({ days: 7 });
        let upcomingSessions = [];

        subscriptions.forEach(sub => {
            if (!sub.sessions || !Array.isArray(sub.sessions)) return;
            sub.sessions.forEach(session => {
                if (!session.utcDateAndTime) return;
                const sessionTime = DateTime.fromISO(session.utcDateAndTime);
                if (sessionTime >= now && sessionTime <= weekLater && session.status !== 'completed' && session.status !== 'missed') {
                    upcomingSessions.push({
                        studentName: sub.student ? sub.student.name : 'غير معروف',
                        teacherName: sub.teacher ? sub.teacher.name : 'غير محدد',
                        courseTitle: sub.course ? sub.course.title : 'غير معروف',
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
        const supervisorId = req.user.id;
        const userRepository = AppDataSource.getRepository('User');
        const teachers = await userRepository.find({ 
            where: { role: 'teacher', supervisor: { id: parseInt(supervisorId) } },
            order: { createdAt: 'DESC' }
        });

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
        const supervisorId = req.user.id;
        const teacherIds = await getAssignedTeacherIds(supervisorId);
        const subscriptionRepository = AppDataSource.getRepository('Subscription');

        let subscriptions = [];
        if (teacherIds.length > 0) {
            subscriptions = await subscriptionRepository.find({
                where: {
                    teacher: { id: In(teacherIds) },
                    status: In(['confirmed', 'completed'])
                },
                relations: ['student', 'course', 'teacher']
            });
        }

        // Group students with their subscriptions
        const studentMap = {};
        subscriptions.forEach(sub => {
            if (!sub.student) return;
            const sid = sub.student.id.toString();
            if (!studentMap[sid]) {
                studentMap[sid] = {
                    student: sub.student,
                    subscriptions: []
                };
            }
            studentMap[sid].subscriptions.push({
                id: sub.id,
                courseTitle: sub.course ? sub.course.title : 'غير معروف',
                teacherName: sub.teacher ? sub.teacher.name : 'غير محدد',
                status: sub.status,
                sessionsCount: sub.sessions && Array.isArray(sub.sessions) ? sub.sessions.length : 0,
                completedSessions: sub.sessions && Array.isArray(sub.sessions) ? sub.sessions.filter(s => s.status === 'completed').length : 0
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
        const supervisorId = req.user.id;
        const teacherIds = await getAssignedTeacherIds(supervisorId);
        const subscriptionRepository = AppDataSource.getRepository('Subscription');

        let startDate = req.query.from ? DateTime.fromISO(req.query.from).startOf('day') : DateTime.now().startOf('day');
        let endDate = req.query.to ? DateTime.fromISO(req.query.to).endOf('day') : DateTime.now().endOf('day');

        if (!startDate.isValid) startDate = DateTime.now().startOf('day');
        if (!endDate.isValid) endDate = DateTime.now().endOf('day');

        let upcomingSessions = [];

        if (teacherIds.length > 0) {
            // TypeORM JSON support varies by DB, we retrieve all matching status and filter JSON in memory
            const subscriptions = await subscriptionRepository.find({
                where: {
                    teacher: { id: In(teacherIds) },
                    status: 'confirmed'
                },
                relations: ['student', 'teacher', 'course']
            });

            subscriptions.forEach(sub => {
                if (!sub.sessions || !Array.isArray(sub.sessions) || sub.sessions.length === 0) return;
                sub.sessions.forEach((session, index) => {
                    if (!session.utcDateAndTime) return;
                    const sessionTime = DateTime.fromISO(session.utcDateAndTime);
                    if (sessionTime >= startDate && sessionTime <= endDate && session.status !== 'completed' && session.status !== 'missed') {
                        if (!sub.student) return;
                        upcomingSessions.push({
                            sessionId: index, // Since Mongo ObjectId for inner arrays is lost in simple JSON, use index
                            subscriptionId: sub.id,
                            studentName: sub.student.name || 'طالب بدون اسم',
                            studentId: sub.student.id,
                            courseTitle: sub.course ? sub.course.title : 'دورة غير معروفة',
                            teacherName: sub.teacher ? sub.teacher.name : 'معلم غير محدد',
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
        }

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
        const userRepository = AppDataSource.getRepository('User');
        const user = await userRepository.findOne({ where: { id: req.user.id } });

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

        user.password = await bcrypt.hash(newPassword, 10);
        await userRepository.save(user);

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
        const userRepository = AppDataSource.getRepository('User');
        const updated = await userRepository.update(req.user.id, { name, phone_number });
        
        if (updated.affected === 0) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
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
        const supervisorId = req.user.id;
        const teacherId = req.params.id;
        const userRepository = AppDataSource.getRepository('User');
        const subscriptionRepository = AppDataSource.getRepository('Subscription');

        // Verify the teacher belongs to this supervisor
        const teacher = await userRepository.findOne({ where: { id: parseInt(teacherId), supervisor: { id: parseInt(supervisorId) } } });
        if (!teacher) return res.status(403).send("غير مسموح لك بالدخول، هذا المعلم لا يتبع لإشرافك");

        let hourly_rates = teacher.hourly_rates || [];
        const teacherHourlyRateDefault = Number(teacher.hour_rate) || (hourly_rates.length > 0 ? hourly_rates[0].rate : 0);

        const allSubscriptions = await subscriptionRepository.find({ 
            where: { teacher: { id: parseInt(teacherId) } },
            relations: ['student', 'course']
        });

        let totalPendingEarnings = 0;
        let completedSessionsCountAll = 0;
        let totalRemainingAll = 0;

        const studentsMap = {};

        allSubscriptions.forEach((sub) => {
          const student = sub.student;
          if (!student) return;

          const studentId = student.id.toString();

          const actualCompleted = sub.sessions && Array.isArray(sub.sessions) ? sub.sessions.filter((s) => s.status === "completed").length : 0;
          const unpaidCompleted = sub.sessions && Array.isArray(sub.sessions) ? sub.sessions.filter((s) => s.status === "completed" && s.isPaidByAdmin !== true).length : 0;
          const totalPlanned = sub.sessions && Array.isArray(sub.sessions) ? sub.sessions.length : 0;
          const remaining = Math.max(0, totalPlanned - actualCompleted);
          
          const duration = Number(sub.selectedPriceOption) || 60;
          const rateToUse = sub.teacherHourlyRate || teacherHourlyRateDefault;
          const subPendingEarnings = unpaidCompleted * (rateToUse * (duration / 60));

          totalPendingEarnings += subPendingEarnings;
          completedSessionsCountAll += actualCompleted;
          totalRemainingAll += remaining;

          if (studentsMap[studentId]) {
            studentsMap[studentId].courses.push(sub.course?.title || "كورس غير محدد");
            studentsMap[studentId].totalSessions += totalPlanned;
            studentsMap[studentId].completedSessions += actualCompleted;
            studentsMap[studentId].remainingSessions += remaining;
            if (remaining > 0) studentsMap[studentId].status = "in-progress";
          } else {
            studentsMap[studentId] = {
              id: studentId,
              name: student.name || "طالب محذوف",
              image: student.image, 
              courses: [sub.course?.title || "كورس غير محدد"],
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
        const supervisorId = req.user.id;
        const teacherId = req.params.id;
        const userRepository = AppDataSource.getRepository('User');
        const subscriptionRepository = AppDataSource.getRepository('Subscription');

        const teacher = await userRepository.findOne({ where: { id: parseInt(teacherId), supervisor: { id: parseInt(supervisorId) } } });
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

        const bookings = await subscriptionRepository.find({ 
            where: { teacher: { id: parseInt(teacherId) } },
            relations: ["student", "course"]
        });

        let weeklySchedule = {};

        bookings.forEach((booking) => {
            if (!booking.sessions || !Array.isArray(booking.sessions)) return;
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
                studentName: booking.student?.name,
                courseTitle: booking.course?.title,
                status: session.status,
                bookingId: booking.id,
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
        const supervisorId = req.user.id;
        const studentId = req.params.id;
        const teacherIds = await getAssignedTeacherIds(supervisorId);
        const userRepository = AppDataSource.getRepository('User');
        const subscriptionRepository = AppDataSource.getRepository('Subscription');

        // Verify the student exists
        const student = await userRepository.findOne({ where: { id: parseInt(studentId) } });
        if (!student) return res.status(404).send('الطالب غير موجود');

        // Check if there's an active subscription with any of the assigned teachers
        const subscriptions = await subscriptionRepository.find({ 
            where: { student: { id: parseInt(studentId) }, teacher: { id: In(teacherIds) } },
            relations: ['course', 'teacher']
        });

        if (subscriptions.length === 0) return res.status(403).send('غير مسموح لك بالدخول لملف هذا الطالب');

        let allSessions = [];
        subscriptions.forEach(sub => {
            if (!sub.sessions || !Array.isArray(sub.sessions)) return;
            sub.sessions.forEach(session => {
                allSessions.push({
                    courseName: sub.course ? sub.course.title : 'كورس غير مسمى',
                    teacherName: sub.teacher ? sub.teacher.name : 'غير محدد',
                    date: session.date,
                    time: session.time,
                    status: session.status,
                    report: session.report,
                    link: sub.teacher ? sub.teacher.zoom_link : '#'
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
