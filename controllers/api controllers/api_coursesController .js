const { DateTime } = require("luxon");
const { AppDataSource } = require('../../config/database');
const { sendPushNotification } = require("../../utility/notificationService");

const getapicourses = async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Ensure we only get courses for the user's academy
  const academyId = req.params.academyId;

  if (!academyId) {
    return res.status(400).json({
      statusCode: 400,
      status: "fail",
      message: "لا توجد أكاديمية مرتبطة بهذا المستخدم."
    });
  }

  const courseRepository = AppDataSource.getRepository('Course');

  const [courses, total] = await courseRepository.findAndCount({
      where: { academy: { id: academyId } },
      relations: ['category'],
      skip,
      take: limit
  });

  res.status(200).json({
    statusCode: 200,
    status: "success",
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
    data: {
      courses,
    },
  });
};

const getapiCourseDetails = async (req, res, next) => {
  const { id } = req.params;
  console.log('Course ID:', id);

  const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
  const courseRepository = AppDataSource.getRepository('Course');

  const course = await courseRepository.findOne({ 
      where: { id: parseInt(id), academy: { id: academyId } } 
  });

  if (!course) {
    return res.status(404).json({ statusCode: 404, status: "fail", message: 'عذراً، لم يتم العثور على هذا الكورس في هذه الأكاديمية.' });
  }

  res.status(200).json({
    statusCode: 200,
    message: "تم الحصول على تفاصيل الكورس بنجاح.",
    status: "success",
    data: {
      course,   
    },  
  });
};

const apiCourseCheckout = async (req, res) => {
  console.log(req.body);
  const { 
    courseId, 
    numberOfSessionsPerMonth, 
    selectedPriceOption, 
    studentId,
    totalAmount,
  } = req.body; 

  console.log(req.body);
  try {
    const subscriptionRepository = AppDataSource.getRepository('Subscription');
    const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);

    const request = subscriptionRepository.create({ 
        course: { id: parseInt(courseId) },
        numberOfSessionsPerMonth,
        selectedPriceOption,
        student: { id: parseInt(studentId) },
        totalAmount,
        academy: { id: parseInt(academyId) }
    });

    await subscriptionRepository.save(request);
    console.log(request);

    res.status(200).json({statusCode: 200, status: "success", data: request});
  } catch (err) {
    console.error(err);
    res.status(400).json({ 
        statusCode: 400,
        status: "fail",
        message: err.message || err
    });
  }
};

const getStudentSessionsPage = async (req, res) => {
  try {
    const userId = req.params.id;
    const subscriptionRepository = AppDataSource.getRepository('Subscription');

    const acceptedRequests = await subscriptionRepository.find({
      where: { student: { id: parseInt(userId) }, status: "confirmed" },
      relations: ["course", "course.category", "student", "teacher"]
    });

    const userTimeZone = req.user?.timezone || "Asia/Riyadh";
    const today = DateTime.now().setZone(userTimeZone).toFormat("yyyy-MM-dd");

    const formattedBookings = acceptedRequests.map((sub) => {
      // Create a plain object manually or parse JSON if needed
      const booking = { ...sub };

      booking.sessions = booking.sessions?.map((session) => {
        const dt = DateTime
          .fromJSDate(new Date(session.utcDateAndTime), { zone: "utc" })
          .setZone(userTimeZone)
          .setLocale("ar");

        const sessionDate = dt.toFormat("yyyy-MM-dd");

        return {
          ...session,
          displayDate: dt.toFormat("yyyy-MM-dd"),
          displayTime: dt.toFormat("hh:mm a"),
          displayDay: dt.toFormat("cccc"),
          zoomLink: booking.teacher?.zoom_link || null,
          isToday: sessionDate === today,
        };
      });

      return booking;
    });

    return res.status(200).json({
      statusCode: 200,
      status: "success",
      data: formattedBookings,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      status: "error",
      message: "Internal Server Error",
    });
  }
};


// --- Student Dashboard API Logic ---

async function getNearestSession(studentId, userTimeZone) {
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
          sessionId: index, // Inner array index
          sessionEnd: sessionEnd,
          startTime: sessionStart
        });
      }
    });
  });

  upcoming.sort((a, b) => a.startTime - b.startTime);
  return upcoming[0] || null;
}

async function getStudentCourseDetails(studentId) {
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
      ])
      .getRawMany();
      
    // Assuming we want the first active matching block or multiple
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("Error calculating total for API:", error);
    return null;
  }
}

async function getStudentStats(studentId) {
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
    console.error("API Dashboard Stats Error:", error);
    return null;
  }
}

const getStudentApiDashboard = async (req, res) => {
  try {
    const studentId = req.user.id || req.user._id;
    const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
    const nearestSession = await getNearestSession(studentId, req.user.timezone);
    const studentStats = await getStudentStats(studentId);
    const courseBookingDetails = await getStudentCourseDetails(studentId);
    
    const settingsRepository = AppDataSource.getRepository('SystemSettings');
    const settings = await settingsRepository.findOne({ where: { academy: { id: academyId } } });
    const whatsapp = settings?.socialLinks?.whatsapp || settings?.supportContact?.student || "";

    res.status(200).json({
      statusCode: 200,
      status: "success",
      data: {
        nearestSession,
        studentStats,
        courseBookingDetails,
        whatsapp,
        user: req.user
      }
    });
  } catch (error) {
    console.error("Error loading student API dashboard:", error);
    res.status(500).json({
      statusCode: 500,
      status: "error",
      message: "حدث خطأ أثناء تحميل بيانات لوحة التحكم الطالب."
    });
  }
};

async function notifyUser(userId, content) {
  console.log(userId, 'user id');
  const userRepository = AppDataSource.getRepository('User');
  const user = await userRepository.findOne({ where: { id: parseInt(userId) } });
  
  console.log(user, 'user');
  if (!user || !user.devices || user.devices.length === 0) return;

  const tokens = user.devices.map(device => device.fcmToken).filter(Boolean);

  if (tokens.length > 0) {
    return await sendPushNotification(tokens, content);
  }
}

const getAcademyInfo = async (req, res) => {
  try {
    const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
    if (!academyId) {
      return res.status(400).json({
        statusCode: 400,
        status: "fail",
        message: "لا توجد أكاديمية مرتبطة بهذا المستخدم."
      });
    }

    const settingsRepository = AppDataSource.getRepository('SystemSettings');
    const settings = await settingsRepository.findOne({ where: { academy: { id: parseInt(academyId) } } });
    
    if (!settings) {
      return res.status(404).json({
        statusCode: 404,
        status: "fail",
        message: "لم يتم العثور على إعدادات لهذه الأكاديمية."
      });
    }

    res.status(200).json({
      statusCode: 200,
      status: "success",
      data: {
        settings
      }
    });
  } catch (error) {
    console.error("Error fetching academy info:", error);
    res.status(500).json({
      statusCode: 500,
      status: "error",
      message: "حدث خطأ أثناء تحميل بيانات الأكاديمية."
    });
  }
};

const getApiCategories = async (req, res) => {
  try {
    const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
    const categoryRepository = AppDataSource.getRepository('Category');
    const categories = await categoryRepository.find({ where: { academy: { id: parseInt(academyId) } } });

    res.status(200).json({
      statusCode: 200,
      status: "success",
      data: categories
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      status: "error",
      message: "Internal Server Error"
    });
  }
};

const getApiBlogPosts = async (req, res) => {
  try {
    const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
    const blogPostRepository = AppDataSource.getRepository('BlogPost');
    
    const posts = await blogPostRepository.find({ 
        where: { academy: { id: parseInt(academyId) }, isPublished: true },
        order: { createdAt: 'DESC' }
    });

    res.status(200).json({
      statusCode: 200,
      status: "success",
      data: posts
    });
  } catch (error) {
    res.status(500).json({
      statusCode: 500,
      status: "error",
      message: "Internal Server Error"
    });
  }
};

// مثال: إرسال إشعار عند نجاح الدفع

module.exports = {
  apiCourseCheckout,
  getapicourses,
  getapiCourseDetails,
  getStudentSessionsPage,
  getStudentApiDashboard,
  getAcademyInfo,
  getApiCategories,
  getApiBlogPosts,
  notifyUser
};
