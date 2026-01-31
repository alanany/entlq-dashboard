
const Subscription = require("../../models/subscription_model");

const Course = require("../../models/course_model");

const getapicourses = async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const courses = await Course.find()
    .skip(skip)
    .limit(limit);

  const total = await Course.countDocuments();

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
  const course = await Course.findById(id);

  if (!course) {
    return res.status(404).json({ statusCode: 404, status: "fail", message: 'عذراً، لم يتم العثور على هذا الكورس.' });
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
            totalAmount
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
  const userId = req.params.id;
  // 1. جلب البيانات من قاعدة البيانات مع الـ Populates
  const acceptedRequests = await Subscription.find({
    studentId:userId,
    status: "confirmed",
  })
    .populate({
      path: "courseId",
      populate: {
        path: "category",
        model: "Category",
      },
    })
    .populate("studentId").populate("teacherId");

  // 2. تحديد المنطقة الزمنية للمستخدم (أو افتراضية إذا لم توجد)
  const userTimeZone =  req.user.timezone || "Asia/Riyadh";

  // 3. معالجة البيانات لتحويل توقيت كل جلسة (Session)
  const formattedBookings = acceptedRequests.map((sub) => {
    // تحويل وثيقة Mongoose إلى كائن عادي لنتمكن من التعديل عليه
    const booking = sub.toObject();

    if (booking.sessions && Array.isArray(booking.sessions)) {
      booking.sessions = booking.sessions.map((session) => {
        // تحويل التاريخ من UTC إلى المنطقة الزمنية للمستخدم باستخدام Luxon
        const dt = DateTime.fromJSDate(new Date(session.utcDateAndTime), { zone: "utc" })
                   .setZone(userTimeZone)
                   .setLocale('ar'); // لجعل الوقت والتاريخ بالعربية
console.log(booking.teacherId.zoom_link,'zoomLink');
const today = DateTime.now().setZone(userTimeZone).toFormat("yyyy-MM-dd");
     const sessionDate = dt.toFormat("yyyy-MM-dd");
return {
          ...session,
          // إضافة حقول منسقة للعرض في الـ EJS
          displayDate: dt.toFormat("yyyy-MM-dd"), // التاريخ: 2026-01-11
          displayTime: dt.toFormat("hh:mm a"),   // الوقت: 01:15 م
          displayDay: dt.toFormat("cccc"),   
          zoomLink:booking.teacherId.zoom_link,
          isToday: sessionDate === today    // اليوم: الأحد
        };
      });
    }
    return booking;
  });
console.log(formattedBookings.zoomLink, "formattedBookings");
  // 4. إرسال البيانات المنسقة (formattedBookings) بدلاً من الأصلية
 
 res.status(200).json({
  statusCode:200,
  status:"success",
  data:formattedBookings
 })

};

module.exports = {
  apiCourseCheckout,
  getapicourses,
  getapiCourseDetails,
  getStudentSessionsPage
};
