
const Subscription = require("../../models/subscription_model");
const { DateTime } = require("luxon");
const Course = require("../../models/course_model");
const User = require("../../models/user_model");
const Category = require("../../models/category_model");
const BlogPost = require("../../models/BlogPost");
const mongoose = require("mongoose");
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

  const courses = await Course.find({ academyId })
    .populate('category')
    .skip(skip)
    .limit(limit);

  const total = await Course.countDocuments({ academyId });

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

const getapiCourseDetails =  async (req, res,next) => {
    const { id } = req.params;
console.log('Course ID:', id); // Debugging line to check the received ID
  const academyId = req.user.academyId;
  const course = await Course.findOne({ _id: id, academyId: academyId });

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
    // 1. استخراج البيانات من جسم الطلب
 
console.log(req.body);
 const { 
        courseId, 
        numberOfSessionsPerMonth, 
        selectedPriceOption, 
        studentId,
        totalAmount, // تم استقبالها بشكل صحيح من الواجهة الأمامية المصححة
       
    } = req.body; 
    console.log(req.body);
    try {
        const request = await Subscription.create({ 
            courseId,
            numberOfSessionsPerMonth,
            selectedPriceOption,
            studentId,
            totalAmount,
            academyId: req.user.academyId
                // يتم إدراج هيكل المنهج الدراسي مباشرة
            // creator: req.user._id // (إذا كنت تستخدم مصادقة)
        });
console.log(request);
        // 4. إرسال استجابة النجاح (عادةً ما يتم إرسال كائن الدورة الجديدة)
        res.status(200).json({statusCode: 200,status: "success",data: request});

    } catch (err) {
        console.error(err);
        // 5. معالجة أخطاء التحقق أو أخطاء قاعدة البيانات
        res.status(400).json({ 
            statusCode: 400,
            status: "fail",
            message: err
        });
    }
};


const getStudentSessionsPage = async (req, res) => {
  try {
    const userId = req.params.id;

    const acceptedRequests = await Subscription.find({
      studentId: userId,
      status: "confirmed",
    })
      .populate({
        path: "courseId",
        populate: { path: "category", model: "Category" },
      })
      .populate("studentId")
      .populate("teacherId");

    const userTimeZone = req.user?.timezone || "Asia/Riyadh";

    const today = DateTime.now()
      .setZone(userTimeZone)
      .toFormat("yyyy-MM-dd");

    const formattedBookings = acceptedRequests.map((sub) => {
      const booking = sub.toObject();

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
          zoomLink: booking.teacherId?.zoom_link || null,
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

    return res.status(500).json({
      statusCode: 500,
      status: "error",
      message: "Internal Server Error",
    });
  }
};

const { sendPushNotification } = require("../../utility/notificationService");

// --- Student Dashboard API Logic ---

async function getNearestSession(studentId, userTimeZone) {
  const subscriptions = await Subscription.find({
    studentId: studentId,
    status: "confirmed",
  }).populate("courseId");

  let upcoming = [];
  const now = new Date();
  const tz = userTimeZone || "UTC";

  subscriptions.forEach((sub) => {
    (sub.sessions || []).forEach((session) => {
      const sessionStart = new Date(session.utcDateAndTime);
      const sessionEnd = new Date(sessionStart.getTime() + 60 * 60 * 1000);

      if (sessionEnd > now && session.status !== "completed") {
        const dt = DateTime.fromJSDate(sessionStart, { zone: "utc" })
          .setZone(tz)
          .setLocale('ar');

        upcoming.push({
          bookingId: sub._id,
          courseTitle: sub.courseId?.title,
          sessionDetails: {
            ...session,
            displayDate: dt.toFormat("yyyy-MM-dd"),
            displayTime: dt.toFormat("hh:mm a"),
            displayDay: dt.toFormat("cccc")
          },
          sessionId: session._id,
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
    const id = new mongoose.Types.ObjectId(studentId);
    const result = await Subscription.aggregate([
      { $match: { studentId: id, status: "confirmed" } },
      {
        $lookup: {
          from: "courses",
          localField: "courseId",
          foreignField: "_id",
          as: "courseInfo"
        }
      },
      { $unwind: "$courseInfo" },
      {
        $project: {
          _id: 0,
          courseName: "$courseInfo.title",
          numberOfSessionsPerMonth: 1,
          pricePerSession: { $toDouble: "$selectedPriceOption" },
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
    console.error("Error calculating total for API:", error);
    return null;
  }
}

async function getStudentStats(studentId) {
  try {
    const id = new mongoose.Types.ObjectId(studentId);
    const stats = await Subscription.aggregate([
      { $match: { studentId: id, status: "confirmed" } },
      { $unwind: "$sessions" },
      {
        $group: {
          _id: "$studentId",
          completedSessions: {
            $sum: { $cond: [{ $eq: ["$sessions.status", "completed"] }, 1, 0] },
          },
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
          totalMinutes: {
            $sum: { $cond: [{ $eq: ["$sessions.status", "completed"] }, 60, 0] }
          },
          totalPlan: { $sum: 1 }
        },
      },
      {
        $project: {
          _id: 0,
          completedSessions: 1,
          rating: { $ifNull: [{ $round: ["$avgRating", 1] }, 0] },
          learningMinutes: 1,
          totalPlan: 1,
          learningHours: { $divide: ["$totalMinutes", 60] }
        },
      },
    ]);
    return stats.length > 0 ? stats[0] : { completedSessions: 0, rating: 0, learningMinutes: 0, totalPlan: 0 };
  } catch (error) {
    console.error("API Dashboard Stats Error:", error);
    return null;
  }
}

const getStudentApiDashboard = async (req, res) => {
  try {
    const studentId = req.user._id;
    const nearestSession = await getNearestSession(studentId, req.user.timezone);
    const studentStats = await getStudentStats(studentId);
    const courseBookingDetails = await getStudentCourseDetails(studentId);

    res.status(200).json({
      statusCode: 200,
      status: "success",
      data: {
        nearestSession,
        studentStats,
        courseBookingDetails,
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

// الدالة اللي كتبتها أنت بتهندل جلب التوكنات من الـ DB
async function notifyUser(userId, content) {
  console.log(userId,'user id');
  const user = await User.findOne ({_id:userId});
  console.log(user,'user');
  if (!user || user.devices.length === 0) return;

  const tokens = user.devices.map(device => device.fcmToken);

  // هنا بننادي على الـ Service اللي فوق
  return await sendPushNotification(tokens, content);
}

const SystemSettings = require("../../models/SystemSettings");

const getAcademyInfo = async (req, res) => {
  try {
    const academyId = req.user.academyId;
    if (!academyId) {
      return res.status(400).json({
        statusCode: 400,
        status: "fail",
        message: "لا توجد أكاديمية مرتبطة بهذا المستخدم."
      });
    }

    const settings = await SystemSettings.findOne({ academyId });
    
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
    const academyId = req.user.academyId;
    const categories = await Category.find({ academyId });
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
    const academyId = req.user.academyId;
    const posts = await BlogPost.find({ academyId, isPublished: true }).sort({ createdAt: -1 });
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
