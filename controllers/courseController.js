const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { DateTime }  = require ("luxon");
const { AppDataSource } = require('../config/database');
const api_coursesController = require('./api controllers/api_coursesController .js');

const convertToUTC = (date, time, zone) => DateTime.fromISO(`${date}T${time}`, { zone }).toUTC().toISO();

const getDashboardStats = async (academyId) => {
    try {
        if (!academyId) return { summary: { students: 0, teachers: 0, courses: 0, revenue: 0 }, popularCourses: [], recentRegistrations: [] };

        const userRepository = AppDataSource.getRepository('User');
        const courseRepository = AppDataSource.getRepository('Course');
        const subscriptionRepository = AppDataSource.getRepository('Subscription');
        const paymentRepository = AppDataSource.getRepository('Payment');

        const totalStudents = await userRepository.count({ where: { role: 'student', academy: { id: parseInt(academyId) } } });
        const totalTeachers = await userRepository.count({ where: { role: 'teacher', academy: { id: parseInt(academyId) } } });
        const activeCourses = await courseRepository.count({ where: { academy: { id: parseInt(academyId) } } });

        const rev = await subscriptionRepository.createQueryBuilder("sub")
            .where("sub.academyId = :aid AND sub.status = 'confirmed'", { aid: parseInt(academyId) })
            .select("SUM(sub.totalAmount)", "total")
            .getRawOne();
        const revenue = parseFloat(rev?.total || 0);

        const popularCoursesQuery = await subscriptionRepository.createQueryBuilder("sub")
            .innerJoinAndSelect("sub.course", "course")
            .where("sub.academyId = :aid AND sub.status = 'confirmed'", { aid: parseInt(academyId) })
            .groupBy("course.id")
            .select(["course.id", "course.title", "course.level"])
            .addSelect("COUNT(sub.id)", "studentsCount")
            .orderBy("studentsCount", "DESC")
            .limit(5)
            .getRawMany();

        const popularCourses = popularCoursesQuery.map(c => ({
            title: c.course_title, level: c.course_level, studentsCount: parseInt(c.studentsCount)
        }));

        const recentSubscriptions = await subscriptionRepository.find({
            where: { academy: { id: parseInt(academyId) } },
            relations: ["student", "course"],
            order: { createdAt: 'DESC' },
            take: 6
        });

        return { summary: { students: totalStudents, teachers: totalTeachers, courses: activeCourses, revenue }, popularCourses, recentRegistrations: recentSubscriptions };
    } catch (error) {
        return { summary: { students: 0, teachers: 0, courses: 0, revenue: 0 }, popularCourses: [], recentRegistrations: [] };
    }
};

const getAdminDashboard = async (req, res) => {
    const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
    const stats = await getDashboardStats(academyId);
    res.render('dashboard/index', { title: 'لوحة تحكم الأدمن', stats, user: req.user }); 
};

const getAllCourses = async (req, res) => {
    const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
    const courseRepository = AppDataSource.getRepository('Course');
    const courses = await courseRepository.find({ where: { academy: { id: parseInt(academyId) } } });
    res.render('dashboard/courses', { title: 'كورسات الموقع', courses, user: req.user });    
}

const getAddCourse = async (req, res) => {
    const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
    const categoryRepository = AppDataSource.getRepository('Category');
    const categories = await categoryRepository.find({ where: { academy: { id: parseInt(academyId) } } });
    res.render('dashboard/add-course', { title: 'اضافة كورس جديد', categories, user: req.user }); 
};

const addCourse = async (req, res) => {
    try {
        let { title, description, level, category, pricingOptions, curriculum } = req.body;
        if (pricingOptions) pricingOptions = JSON.parse(pricingOptions);
        if (curriculum) curriculum = JSON.parse(curriculum);

        const coverImagePath = req.file ? `/uploads/${req.file.filename}` : null;
        if (!title || !description || !category || !curriculum || curriculum.length === 0) {
            return res.status(400).json({ message: 'الرجاء إكمال كافة البيانات المطلوبة' });
        }

        const courseRepository = AppDataSource.getRepository('Course');
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);

        const newCourse = courseRepository.create({
            title, description, level,
            category: { id: parseInt(category) },
            pricingOptions, curriculum, coverImage: coverImagePath,
            academy: { id: parseInt(academyId) }
        });

        await courseRepository.save(newCourse);
        res.status(201).json({ message: 'تم نشر الدورة بنجاح', course: newCourse });
    } catch (err) {
        res.status(500).json({ message: err.message || 'حدث خطأ في السيرفر' });
    }
};

const getEditCourse = async (req, res) => {
    try {
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        const categoryRepository = AppDataSource.getRepository('Category');
        const courseRepository = AppDataSource.getRepository('Course');

        const categories = await categoryRepository.find({ where: { academy: { id: parseInt(academyId) } } });
        const course = await courseRepository.findOne({ where: { id: parseInt(req.params.id), academy: { id: parseInt(academyId) } }, relations: ["category"] });

        if (!course) return res.status(404).render('404', { message: 'الدورة غير موجودة.' });

        res.render('dashboard/edit_course', { title: `تعديل الدورة: ${course.title}`, course, categories, user: req.user });
    } catch (err) {
        res.status(500).render('error', { message: 'فشل في تحميل بيانات الدورة.' });
    }
};

const updateCoursePost = async (req, res) => {
   try {
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        const courseRepository = AppDataSource.getRepository('Course');
        
        let { title, description, level, category, pricingOptions, curriculum, isPublished } = req.body;
        if (pricingOptions) pricingOptions = JSON.parse(pricingOptions);
        if (curriculum) curriculum = JSON.parse(curriculum);

        let course = await courseRepository.findOne({ where: { id: parseInt(req.params.id), academy: { id: parseInt(academyId) } } });
        if (!course) return res.status(404).json({ message: "الدورة غير موجودة" });

        course.title = title; course.description = description; course.level = level; course.category = { id: parseInt(category) };
        course.pricingOptions = pricingOptions; course.curriculum = curriculum;
        if (isPublished !== undefined) course.isPublished = isPublished === 'true';

        if (req.file) {
            if (course.coverImage) {
                const oldImagePath = path.join(__dirname, '..', course.coverImage);
                if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
            }
            course.coverImage = `/uploads/${req.file.filename}`;
        }

        await courseRepository.save(course);
        res.status(200).json({ message: "تم تحديث الدورة بنجاح", course });
    } catch (error) {
        res.status(500).json({ message: "حدث خطأ أثناء التحديث" });
    }
};

const deleteCourse = async (req, res) => {
    try {
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        const courseRepository = AppDataSource.getRepository('Course');
        
        const course = await courseRepository.findOne({ where: { id: parseInt(req.params.id), academy: { id: parseInt(academyId) } } });
        if (!course) return res.status(404).json({ message: 'الدورة غير موجودة ولا يمكن حذفها.' });

        if (course.coverImage) {
            const imagePath = path.join(__dirname, '..', course.coverImage);
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        }

        await courseRepository.remove(course);
        res.status(200).json({ message: 'تم حذف الدورة بنجاح.', courseId: req.params.id });
    } catch (err) {
        res.status(500).json({ message: 'فشل في عملية الحذف الداخلي للخادم.' });
    }
};

const home_website_get = async(req, res) => {
    try {
        const academyId = req.user?.academyId || (req.user?.academy && req.user?.academy.id) || res.locals.settings?.academy?.id;
        
        const websiteSectionRepository = AppDataSource.getRepository('WebsiteSection');
        const blogPostRepository = AppDataSource.getRepository('BlogPost');
        const courseRepository = AppDataSource.getRepository('Course');

        const sectionsFilter = academyId ? { academy: { id: parseInt(academyId) } } : {};
        const sections = await websiteSectionRepository.find({ where: sectionsFilter });

        const blogPostsFilter = academyId ? { isPublished: true, academy: { id: parseInt(academyId) } } : { isPublished: true };
        const blogPosts = await blogPostRepository.find({ where: blogPostsFilter, order: { createdAt: 'DESC' }, take: 3 });

        const coursesFilter = academyId ? { academy: { id: parseInt(academyId) }, isPublished: true } : { isPublished: true };
        const courses = await courseRepository.find({ where: coursesFilter, take: 6 });
        
        const sectionsMap = {};
        sections.forEach(s => { sectionsMap[s.key] = s; });
        
        res.render('../views/website/home', { title: 'كورسات الموقع', courses, sections: sectionsMap, blogPosts, user: req.user });
    } catch (err) {
        res.status(500).send('Server Error');
    }
}

const getLandingPage = (req, res) => {
    if (req.user) return res.redirect('/dashboard');
    res.render('../views/website/landing', { user: req.user });
};

const getLandingPageForDashboard = (req, res) => res.render('../views/website/landing', { user: req.user });

const allCourses_website_get = async(req, res) => {
    try {
        const academyId = req.user?.academyId || (req.user?.academy && req.user?.academy.id) || res.locals.settings?.academy?.id;
        const courseRepository = AppDataSource.getRepository('Course');
        const categoryRepository = AppDataSource.getRepository('Category');
        
        const coursesFilter = academyId ? { academy: { id: parseInt(academyId) }, isPublished: true } : { isPublished: true };
        const courses = await courseRepository.find({ where: coursesFilter, relations: ["category"] });
        
        const categories = academyId ? await categoryRepository.find({ where: { academy: { id: parseInt(academyId) } } }) : await categoryRepository.find();
        
        const categoriesWithCount = await Promise.all(categories.map(async (cat) => {
            const count = await courseRepository.count({ where: { category: { id: cat.id }, academy: { id: parseInt(academyId) }, isPublished: true } });
            return { ...cat, count, slug: cat.slug || cat.name.replace(/\s+/g, '-').toLowerCase() };
        }));

        res.render('../views/website/course-list', { title: 'كورسات الموقع', courses, categories: categoriesWithCount, user: req.user });
    } catch (err) {
        res.status(500).send('Server Error');
    }
}

const getCourseDetails = async (req, res) => {
    try {
        const courseRepository = AppDataSource.getRepository('Course');
        const course = await courseRepository.findOne({ where: { id: parseInt(req.params.id) }, relations: ["category", "academy"] });
        
        if (!course) return res.status(404).render('404', { message: 'عذراً، لم يتم العثور على هذا الكورس.' });

        const relatedCourses = await courseRepository.createQueryBuilder("course")
            .innerJoinAndSelect("course.category", "category")
            .where("course.academyId = :aid AND course.isPublished = true AND course.id != :cid", { aid: course.academy.id, cid: course.id })
            .limit(6)
            .getMany();

        res.render('../views/website/course-details', { course, title: course.title, user: req.user, relatedCourses });
    } catch (error) {
        res.status(500).render('error', { message: 'حدث خطأ أثناء جلب تفاصيل الكورس.' });
    }
};

const checkout = async (req, res) => {
    const { courseId, numberOfSessionsPerMonth, selectedPriceOption, studentId, totalAmount, academyId, renewFromId } = req.body; 
    try {
        const subscriptionRepository = AppDataSource.getRepository('Subscription');
        const userRepository = AppDataSource.getRepository('User');
        let additionalFields = {};

        if (renewFromId) {
            const oldSub = await subscriptionRepository.findOne({ where: { id: parseInt(renewFromId) }, relations: ["teacher"] });
            if (oldSub) {
                if(oldSub.teacher) additionalFields.teacher = { id: oldSub.teacher.id };
                additionalFields.teacherHourlyRate = oldSub.teacherHourlyRate;

                let teacherZoomLink = oldSub.teacher?.zoom_link || '';
                let newStartDate = DateTime.now().plus({ days: 1 }).startOf('day');
                
                if (oldSub.startDate) {
                    newStartDate = DateTime.fromJSDate(oldSub.startDate).plus({ months: 1 });
                    additionalFields.startDate = newStartDate.toJSDate();
                }

                if (oldSub.sessions && oldSub.sessions.length > 0) {
                    const patterns = [];
                    const seen = new Set();
                    oldSub.sessions.forEach(s => {
                        const dt = DateTime.fromJSDate(new Date(s.date)).setZone('utc');
                        const key = `${dt.weekday}-${s.time}`;
                        if (!seen.has(key)) { seen.add(key); patterns.push({ weekday: dt.weekday, time: s.time, duration: s.durationMinutes }); }
                    });
                    patterns.sort((a, b) => a.weekday - b.weekday);

                    if (patterns.length > 0) {
                        const generatedSessionsFull = [];
                        let count = 0, ptrDate = newStartDate; 
                        while (count < parseInt(numberOfSessionsPerMonth) || 0) {
                            const p = patterns.find(p => p.weekday === ptrDate.weekday);
                            if (p) {
                                generatedSessionsFull.push({
                                    date: ptrDate.toJSDate(), time: p.time, durationMinutes: p.duration || parseInt(selectedPriceOption),
                                    status: 'pending', utcDateAndTime: convertToUTC(ptrDate.toISODate(), p.time, req.user?.timezone || 'UTC'), link: teacherZoomLink
                                });
                                count++;
                            }
                            ptrDate = ptrDate.plus({ days: 1 });
                            if (count > 100) break;
                        }
                        additionalFields.sessions = generatedSessionsFull;
                    }
                }
            }
        }

        const request = subscriptionRepository.create({ 
            course: { id: parseInt(courseId) }, numberOfSessionsPerMonth, selectedPriceOption,
            student: { id: parseInt(studentId) }, academy: { id: parseInt(academyId) }, totalAmount, ...additionalFields
        });
        await subscriptionRepository.save(request);

        res.status(200).json({ data: request, success: true, message: 'تم إنشاء الطلب بنجاح' });
    } catch (err) {
        res.status(400).json({ message: err.message || "حدث خطأ أثناء المعالجة" });
    }
};

const getAdminSubscription = async (req, res) => {
    try {
        const subscriptionRepository = AppDataSource.getRepository('Subscription');
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        
        let subscriptions = await subscriptionRepository.find({ 
            where: { academy: { id: parseInt(academyId) } },
            relations: ["course", "course.category", "student", "teacher"],
            order: { createdAt: 'DESC' }
        });

        subscriptions = subscriptions.filter(sub => sub.student !== null);
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const enhancedSubscriptions = subscriptions.map(sub => {
            let subObj = { ...sub };
            if (sub.startDate) {
                const startDate = new Date(sub.startDate);
                const endDate = new Date(startDate);
                endDate.setMonth(startDate.getMonth() + 1);
                endDate.setHours(0, 0, 0, 0);

                const diffInDays = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                subObj.daysRemaining = diffInDays;
                
                const timeCritical = diffInDays <= 5 && diffInDays >= -30; 
                let sessionsCritical = false;
                if (sub.sessions && sub.sessions.length > 0) {
                    if (sub.sessions.filter(s => s.status === 'pending').length < 2) sessionsCritical = true;
                }
                subObj.isCritical = (sub.status === 'confirmed' || sub.status === 'paid') && (timeCritical || sessionsCritical);
            } else {
                subObj.isCritical = false;
            }
            return subObj;
        });

        res.render('../views/dashboard/admin_enrollment_management.ejs', { 
            title: 'إدارة الطلبات والاشتراكات', bookings: enhancedSubscriptions,
            stats: {
                totalRequests: subscriptions.length, pendingRequests: subscriptions.filter(b => b.status === 'pending').length,
                criticalSubscriptions: enhancedSubscriptions.filter(b => b.isCritical).length,
                acceptedRequests: subscriptions.filter(b => b.status === 'confirmed').length,
                rejectedRequests: subscriptions.filter(b => b.status === 'rejected').length
            }, user: req.user
        });
    } catch (err) {
        res.status(500).send("خطأ في جلب البيانات");
    }  
}

const confirmBookingPayment = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { startDate, paymentStatus, teacherId, teacherHourlyRate, adminNotes } = req.body;
    const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
    const subscriptionRepository = AppDataSource.getRepository('Subscription');
    const userRepository = AppDataSource.getRepository('User');
    const paymentRepository = AppDataSource.getRepository('Payment');

    if (!startDate || !paymentStatus || !teacherId) return res.status(400).json({ success: false, message: 'يرجى تعبئة جميع الحقول' });

    const teacher = await userRepository.findOne({ where: { id: parseInt(teacherId), role: 'teacher', academy: { id: parseInt(academyId) } } });
    if (!teacher) return res.status(400).json({ success: false, message: 'المعلم المختار غير تابع لهذه الأكاديمية' });

    let updateData = {
      startDate, status: paymentStatus, teacher: { id: parseInt(teacherId) },
      teacherHourlyRate: Number(teacherHourlyRate) || 0, adminNotes: adminNotes || '', confirmedBy: req.user.name
    };

    if (req.file) updateData.paymentScreenshot = `/uploads/${req.file.filename}`;
    if (paymentStatus === 'confirmed') updateData.confirmedAt = new Date();

    let booking = await subscriptionRepository.findOne({ where: { id: parseInt(bookingId), academy: { id: parseInt(academyId) } }, relations: ["student"] });
    if (!booking) return res.status(404).json({ success: false, message: 'الحجز غير موجود' });

    subscriptionRepository.merge(booking, updateData);
    booking = await subscriptionRepository.save(booking);

    if (paymentStatus === 'confirmed') {
        const payment = paymentRepository.create({
            type: 'income', category: 'subscription', amount: booking.totalAmount, 
            subscriptionId: booking.id, fromUser: booking.student?.id,
            description: `تسجيل باقة اشتراك جديد`, status: 'completed', academy: { id: parseInt(academyId) }
        });
        await paymentRepository.save(payment);
        
        await api_coursesController.notifyUser(booking.student?.id, {
            title: "تم تسجيل الاشتراك بنجاح! ✅", body: "يمكنك الآن البدء فى الدورة التدريبية.",
            data: { screen: "course_details", courseId: booking.course?.id || 0 }
        });
    }

    return res.status(200).json({ success: true, message: 'تم تحديث بيانات الحجز والدفع بنجاح' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'حدث خطأ أثناء تأكيد الدفع' });
  }
};

const getSubscriptionDetails = async (req, res) => {
    try {
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        const subscriptionRepository = AppDataSource.getRepository('Subscription');
        const booking = await subscriptionRepository.findOne({ 
            where: { id: parseInt(req.params.id), academy: { id: parseInt(academyId) } }, relations: ['student', 'course', 'teacher'] 
        });

        if (!booking) return res.status(404).render('404'); 
        res.render('dashboard/subscription_details', { booking, user: req.user, title: 'تفاصيل الاشتراك' }); 
    } catch (error) {
        res.status(500).send('Server Error');
    }
};

const getManagePayment = async (req, res) => {
    try {
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        const subscriptionRepository = AppDataSource.getRepository('Subscription');
        const userRepository = AppDataSource.getRepository('User');

        const booking = await subscriptionRepository.findOne({ where: { id: parseInt(req.params.id), academy: { id: parseInt(academyId) } }, relations: ['student', 'course'] });
        const teachers = await userRepository.find({ where: { role: 'teacher', status: 'active', academy: { id: parseInt(academyId) } } }); 

        if (!booking) return res.status(404).render('404'); 
        res.render('dashboard/confirm_payment', { booking, teachers, user: req.user }); 
    } catch (error) {
        res.status(500).send('Server Error');
    }
};

const getScheduleSessions = async (req, res) => {
    try {
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        const subscriptionRepository = AppDataSource.getRepository('Subscription');
        const booking = await subscriptionRepository.findOne({ where: { id: parseInt(req.params.id), academy: { id: parseInt(academyId) } }, relations: ['student', 'course', 'teacher'] });
            
        if (!booking) return res.status(404).send('Booking not found.');
        res.render('dashboard/schedule-sessions', { booking, user: req.user }); 
    } catch (error) {
        res.status(500).send('Server Error');
    }
};

const postUpdateSessions = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { sessions } = req.body;
    const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
    const subscriptionRepository = AppDataSource.getRepository('Subscription');

    if (!Array.isArray(sessions)) return res.status(400).send('Invalid sessions data.');

    const booking = await subscriptionRepository.findOne({ where: { id: parseInt(bookingId), academy: { id: parseInt(academyId) } }, relations: ['teacher'] });
    if (!booking || !booking.startDate) return res.status(400).send('Invalid booking or missing start date.');

    const teacherZoomLink = booking.teacher?.zoom_link || "";
    const courseStartDate = new Date(booking.startDate);
    const maxDateLimit = new Date(courseStartDate); maxDateLimit.setDate(maxDateLimit.getDate() + 30); 

    const cleanedSessions = sessions.map((session, index) => {
        const oldSession = booking.sessions ? booking.sessions[index] : null;
        if (oldSession?.status === 'completed') return oldSession;
        if (!session.date || !session.time) throw new Error(`Missing date or time in session ${index + 1}`);

        const sessionDate = new Date(session.date);
        if (sessionDate < courseStartDate || sessionDate > maxDateLimit) throw new Error(`Session ${index + 1} date is outside allowed range`);

        const sessionData = {
            status: session.status || 'pending', date: session.date, time: session.time,
            utcDateAndTime: convertToUTC(session.date, session.time, req.user.timezone || 'Asia/Riyadh'), 
            endtime: session.endtime, link: teacherZoomLink
        };
        if (session._id || session.id) sessionData.id = session._id || session.id;
        return sessionData;
    });

    booking.sessions = cleanedSessions;
    await subscriptionRepository.save(booking);
    return res.redirect('/subscriptions');
  } catch (error) {
    if (error.message.startsWith('Session')) return res.status(400).send(error.message);
    res.status(500).send('Server Error');
  }
};

const getManageSessionsLinks = async (req, res) => {
    try {
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        const subscriptionRepository = AppDataSource.getRepository('Subscription');
        const booking = await subscriptionRepository.findOne({ where: { id: parseInt(req.params.id), academy: { id: parseInt(academyId) } }, relations: ['student', 'course'] });

        if (!booking) return res.status(404).send('Booking not found.');
        res.render('dashboard/manage_sessions_links', { booking, user: req.user }); 
    } catch (error) {
        res.status(500).send('Server Error');
    }
};

const postUpdateSessionsLinks = async (req, res) => {
    try {
        const subscriptionRepository = AppDataSource.getRepository('Subscription');
        let booking = await subscriptionRepository.findOne({ where: { id: parseInt(req.params.id) } });
        if(booking) {
            booking.sessions = req.body.sessions;
            await subscriptionRepository.save(booking);
        }
        res.redirect('/subscriptions'); 
    } catch (error) {
        res.status(500).send('Server Error');
    }
};

const getManageStudents = async (req, res) => {
    try {
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        const userRepository = AppDataSource.getRepository('User');
        const students = await userRepository.find({ 
            where: { role: 'student', academy: { id: parseInt(academyId) } },
            select: ['id', 'name', 'email', 'phone_number', 'country_code', 'status', 'createdAt', 'role'],
            order: { createdAt: 'DESC' }
        });
        res.render('dashboard/students', { students, user: req.user });
    } catch (error) {
        res.status(500).send("حدث خطأ في جلب البيانات");
    }
};

const markSessionAsComplete = async (req, res, next) => {
    try {
        const { bookingId, sessionId } = req.params;
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        const subscriptionRepository = AppDataSource.getRepository('Subscription');
        
        const booking = await subscriptionRepository.findOne({ where: { id: parseInt(bookingId), academy: { id: parseInt(academyId) } } });
        if (!booking) return res.status(404).json({ message: 'Booking not found.' });

        if(booking.sessions && booking.sessions[sessionId]) {
            booking.sessions[sessionId].status = 'completed';
            await subscriptionRepository.save(booking);
            res.redirect(`/booking/${bookingId}/schedule`);
        } else {
            return res.status(404).json({ message: 'Session not found in this booking.' });
        }
    } catch (error) {
        next(error);
    }
};

const adminReportPage = async(req, res) => {
    try {
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        const paymentRepository = AppDataSource.getRepository('Payment');
        const subscriptionRepository = AppDataSource.getRepository('Subscription');

        const { month, type } = req.query;
        
        const incQuery = await paymentRepository.createQueryBuilder("pay").where("pay.academyId = :aid AND pay.type = 'income' AND pay.status = 'completed'", { aid: academyId }).select("SUM(pay.amount)", "total").getRawOne();
        const totalIncome = parseFloat(incQuery?.total || 0);

        const expQuery = await paymentRepository.createQueryBuilder("pay").where("pay.academyId = :aid AND (pay.type = 'expense' OR pay.teacherId IS NOT NULL OR pay.status = 'paid')", { aid: academyId }).select("SUM(pay.amount)", "total").getRawOne();
        const totalExpenses = parseFloat(expQuery?.total || 0);

        const netProfit = totalIncome - totalExpenses;

        const subs = await subscriptionRepository.find({ where: { academy: { id: parseInt(academyId) } }, relations: ["teacher"] });
        let pendingExpenses = 0;
        subs.forEach(s => {
            if(s.sessions) {
                s.sessions.forEach(sess => {
                   if(sess.status === 'completed' && !sess.isPaidByAdmin) {
                       const priceOpt = parseFloat(s.selectedPriceOption || 0);
                       const hrRate = parseFloat(s.teacherHourlyRate || s.teacher?.hour_rate || 0);
                       pendingExpenses += (priceOpt / 60.0) * hrRate;
                   } 
                });
            }
        });

        let qb = paymentRepository.createQueryBuilder("pay")
                    .where("pay.academyId = :aid", { aid: parseInt(academyId) })
                    .leftJoinAndSelect("pay.fromUser", "fromUser")
                    .leftJoinAndSelect("pay.toUserUser", "toUser")
                    .leftJoinAndSelect("pay.teacher", "teacher")
                    .orderBy("pay.createdAt", "DESC").limit(50);
                    
        if (type && (type === 'income' || type === 'expense')) qb.andWhere("pay.type = :type", { type });
        if (month) {
            const [year, monthNum] = month.split('-').map(Number);
            if (year && monthNum) {
                const start = new Date(year, monthNum - 1, 1);
                const end = new Date(year, monthNum, 0, 23, 59, 59, 999);
                qb.andWhere("pay.createdAt >= :start AND pay.createdAt <= :end", { start, end });
            }
        }
        const transactions = await qb.getMany();

        const rawMonths = await paymentRepository.query("SELECT YEAR(createdAt) as year, MONTH(createdAt) as month FROM payments WHERE academyId = ? GROUP BY YEAR(createdAt), MONTH(createdAt) ORDER BY year DESC, month DESC LIMIT 12", [academyId]);
        const availableMonths = rawMonths.map(rm => ({ _id: { year: rm.year, month: rm.month } }));

        res.render('../views/dashboard/reports', { 
            title: 'التقارير المالية', stats: { totalIncome: totalIncome.toFixed(2), totalExpenses: totalExpenses.toFixed(2), netProfit: netProfit.toFixed(2), pendingExpenses: pendingExpenses.toFixed(2) },
            transactions, availableMonths, filters: { month: month || '', type: type || '' }, user: req.user
        });
    } catch (err) {
        res.status(500).send("خطأ في تحميل التقارير المالية");
    }
}

const adminTeachersPage = async (req, res) => {
    try {
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        const userRepository = AppDataSource.getRepository('User');
        const teachers = await userRepository.find({ where: { role: 'teacher', academy: { id: parseInt(academyId) } }, relations: ["supervisor"], order: { createdAt: 'DESC' } });
        const supervisors = await userRepository.find({ where: { role: 'supervisor', academy: { id: parseInt(academyId) } }, select: ["id", "name"] });

        res.render('../views/dashboard/teachers', { teachers, supervisors, user: req.user });
    } catch (err) {
        res.status(500).render('error', { message: "حدث خطأ أثناء جلب بيانات المعلمين" });
    }
};

const updateTeacher = async (req, res) => {
    try {
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        const userRepository = AppDataSource.getRepository('User');
        let updates = {
            name: req.body.name, zoom_link: req.body.zoom_link, phone_number: req.body.phone_number,
            notes: req.body.notes, hourly_rates: req.body.hourly_rates
        };
        if(req.body.supervisorId) updates.supervisor = { id: parseInt(req.body.supervisorId) };

        const updated = await userRepository.update({ id: parseInt(req.params.id), academy: { id: parseInt(academyId) } }, updates);
        if (updated.affected === 0) return res.status(404).json({ success: false, message: 'المعلم غير موجود' });
        res.json({ success: true, message: 'تم تحديث البيانات بنجاح' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'خطأ داخلي في السيرفر' });
    }
};

const addTeacher = async (req, res) => {
    try {
        const { name, phone_number, zoom_link, notes, email, supervisorId, hourly_rates } = req.body;
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        const userRepository = AppDataSource.getRepository('User');
        
        if (await userRepository.findOne({ where: { email } })) return res.status(400).json({ success: false, message: 'البريد الإلكتروني مستخدم بالفعل' });

        const hashedPassword = await bcrypt.hash('password123', 10);
        let newTeacherData = {
            name, phone_number, zoom_link, hourly_rates, notes, email, password: hashedPassword,
            role: 'teacher', status: 'active', academy: { id: parseInt(academyId) }
        };
        if(supervisorId) newTeacherData.supervisor = { id: parseInt(supervisorId) };

        await userRepository.save(userRepository.create(newTeacherData));
        res.status(201).json({ success: true, message: 'تم إضافة المعلم بنجاح' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'حدث خطأ أثناء حفظ البيانات' });
    }
};

const checkConflict = async (req, res) => {
    try {
        const { teacherId, date, time, bookingId } = req.body;
        const [hours, minutes] = time.split(':').map(Number);
        const newStartTotal = hours * 60 + minutes;
        const sessionDuration = 60; 
        const newEndTotal = newStartTotal + sessionDuration;

        const targetDate = new Date(date);
        const startOfDay = new Date(targetDate.setHours(0,0,0,0));
        const endOfDay = new Date(targetDate.setHours(23,59,59,999));

        const subscriptionRepository = AppDataSource.getRepository('Subscription');
        const qb = subscriptionRepository.createQueryBuilder("sub")
            .where("sub.teacherId = :tid", { tid: parseInt(teacherId) });
        if(bookingId) qb.andWhere("sub.id != :bid", { bid: parseInt(bookingId) });
        const bookings = await qb.getMany();

        let hasConflict = false;
        for (const booking of bookings) {
            if(booking.sessions) {
                for (const session of booking.sessions) {
                    if (new Date(session.date).toDateString() === startOfDay.toDateString() && session.status !== 'missed') {
                        const [sHours, sMinutes] = session.time.split(':').map(Number);
                        const existStart = sHours * 60 + sMinutes;
                        const existEnd = existStart + sessionDuration;
                        if (newStartTotal < existEnd && newEndTotal > existStart) { hasConflict = true; break; }
                    }
                }
            }
            if (hasConflict) break;
        }

        if (hasConflict) return res.json({ conflict: true, message: "⚠️ تعارض زمني: يوجد حصة أخرى في هذا الوقت" });
        res.json({ conflict: false });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

const getUpcomingSessions = async (req, res) => {
    try {
        let startDate = req.query.from ? DateTime.fromISO(req.query.from).startOf('day') : DateTime.now().startOf('day');
        let endDate = req.query.to ? DateTime.fromISO(req.query.to).endOf('day') : DateTime.now().endOf('day');
        if (!startDate.isValid) startDate = DateTime.now().startOf('day');
        if (!endDate.isValid) endDate = DateTime.now().endOf('day');

        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        const subscriptionRepository = AppDataSource.getRepository('Subscription');
        
        const subscriptions = await subscriptionRepository.find({ 
            where: { academy: { id: parseInt(academyId) }, status: 'confirmed' },
            relations: ['student', 'teacher', 'course']
        });

        let upcomingSessions = [];
        subscriptions.forEach(sub => {
            if (!sub.sessions) return;
            sub.sessions.forEach((session, idx) => {
                if (!session.utcDateAndTime) return;
                const sessionTime = DateTime.fromISO(session.utcDateAndTime);
                if (sessionTime >= startDate && sessionTime <= endDate && session.status !== 'completed' && session.status !== 'missed') {
                    if (!sub.student) return;
                    upcomingSessions.push({
                         sessionId: idx, subscriptionId: sub.id,
                         studentName: sub.student.name || 'طالب بدون اسم', studentId: sub.student.id,
                         courseTitle: sub.course ? sub.course.title : 'دورة غير معروفة',
                         teacherName: sub.teacher ? sub.teacher.name : 'معلم غير محدد',
                         date: session.date, time: session.time,
                         displayDate: sessionTime.setZone('Asia/Riyadh').toFormat('yyyy-MM-dd'),
                         displayTime: sessionTime.setZone('Asia/Riyadh').toFormat('hh:mm a'),
                         utcDate: session.utcDateAndTime, link: session.link
                    });
                }
            });
        });

        upcomingSessions.sort((a, b) => DateTime.fromISO(a.utcDate) - DateTime.fromISO(b.utcDate));

        res.render('dashboard/upcoming_sessions', { 
            title: 'الجلسات القادمة وإرسال الإشعارات', sessions: upcomingSessions, user: req.user,
            filters: { from: startDate.toFormat('yyyy-MM-dd'), to: endDate.toFormat('yyyy-MM-dd') }
        });
    } catch (error) {
        res.status(500).send("Server Error");
    }
};

const sendSessionNotification = async (req, res) => {
    try {
        const { title, body, sessionIds } = req.body;
        if (!title || !body) return res.status(400).json({ success: false, message: "Title and body are required" });

        let userIdsToNotify = new Set();
        if (sessionIds && Array.isArray(sessionIds) && sessionIds.length > 0) {
            // Note: with JSON columns, query exact session ids is harder, but typically we send notification to all students of the subscription if needed
            // However, sessionIds passed here might just be subscriptionIds or indices. 
            // In typical use case from UI, it might be passing subscriptionIds. Will assume subscriptionIds for simplicity.
            const subscriptionRepository = AppDataSource.getRepository('Subscription');
            const subs = await subscriptionRepository.find({ where: { id: require('typeorm').In(sessionIds.map(Number)) }, relations: ["student"] });
            subs.forEach(s => { if(s.student) userIdsToNotify.add(s.student.id.toString()); });
        }
        
        if (userIdsToNotify.size === 0) return res.json({ success: true, count: 0, message: "No users found" });

        const notifications = [];
        for (const userId of userIdsToNotify) {
            notifications.push(api_coursesController.notifyUser(userId, { title, body, data: { screen: 'sessions' } }));
        }
        await Promise.all(notifications);
        res.json({ success: true, count: userIdsToNotify.size });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const adminSupervisorsPage = async (req, res) => {
    try {
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        const userRepository = AppDataSource.getRepository('User');
        const supervisors = await userRepository.find({ where: { role: 'supervisor', academy: { id: parseInt(academyId) } }, order: { createdAt: 'DESC' } });
        res.render('../views/dashboard/supervisors', { supervisors, user: req.user, title: 'إدارة المشرفين' });
    } catch (err) {
        res.status(500).render('error', { message: "حدث خطأ" });
    }
};

const addSupervisor = async (req, res) => {
    try {
        const { name, phone_number, email } = req.body;
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        const userRepository = AppDataSource.getRepository('User');

        if (await userRepository.findOne({ where: { email } })) return res.status(400).json({ success: false, message: 'البريد مستخدم بالفعل' });

        const newSupervisor = userRepository.create({
            name, phone_number, email, password: await bcrypt.hash('password123', 10),
            role: 'supervisor', status: 'active', academy: { id: parseInt(academyId) }
        });
        await userRepository.save(newSupervisor);
        res.status(201).json({ success: true, message: 'تم إضافة المشرف بنجاح' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'حدث خطأ' });
    }
};

const updateSupervisor = async (req, res) => {
    try {
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        const userRepository = AppDataSource.getRepository('User');
        const updated = await userRepository.update({ id: parseInt(req.params.id), academy: { id: parseInt(academyId) } }, { name: req.body.name, phone_number: req.body.phone_number, email: req.body.email });
        if (updated.affected === 0) return res.status(404).json({ success: false, message: 'المشرف غير موجود' });
        res.json({ success: true, message: 'تم التحديث بنجاح' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'خطأ داخلي في السيرفر' });
    }
};

const deleteSupervisor = async (req, res) => {
    try {
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        const userRepository = AppDataSource.getRepository('User');
        const deleted = await userRepository.delete({ id: parseInt(req.params.id), academy: { id: parseInt(academyId) } });
        if (deleted.affected === 0) return res.status(404).json({ success: false, message: 'المشرف غير موجود' });
        res.json({ success: true, message: 'تم الحذف' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'خطأ في السيرفر' });
    }
};

module.exports = {
    getLandingPageForDashboard, getDashboardStats, checkConflict, adminReportPage, getAdminDashboard,
    getAdminSubscription, addTeacher, getAddCourse, adminTeachersPage, updateTeacher, addCourse,
    getAllCourses, getEditCourse, updateCoursePost, getManagePayment, deleteCourse, home_website_get,
    getLandingPage, allCourses_website_get, getCourseDetails, checkout, confirmBookingPayment,
    getSubscriptionDetails, getScheduleSessions, postUpdateSessions, getManageSessionsLinks,
    postUpdateSessionsLinks, getManageStudents, markSessionAsComplete, getUpcomingSessions,
    sendSessionNotification, adminSupervisorsPage, addSupervisor, updateSupervisor, deleteSupervisor
};
