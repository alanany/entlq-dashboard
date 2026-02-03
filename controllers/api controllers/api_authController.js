const User = require("../../models/user_model");
const bcrypt = require("bcryptjs");
const httpStatus = require("../../utility/http_status");
const AppError = require("../../utility/app_error");
const asyncWrapper = require("../../middleware/async_wrapper");
const generateJWT = require("../../middleware/generate_jwt");


// handle errors

// controller actions


const login = async (req, res, next) => {
  try {
    const {
      email,
      password,
      deviceToken,
      platform = "andriod",
      deviceModel,
      timezone,
    } = req.body;

    // 1️⃣ جلب المستخدم (كلمة المرور مطلوبة)
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        status: "fail",
        message: "هذا البريد الإلكتروني غير صحيح",
      });
    }

    // 2️⃣ مقارنة كلمة المرور
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        status: "fail",
        message: "كلمة المرور المدخلة غير صحيحة",
      });
    }

    // 3️⃣ إضافة / تحديث الجهاز (بدون save)
    if (deviceToken && platform !== "web") {
      await User.updateOne(
        { _id: user._id },
        {
          $pull: {
            devices: { fcmToken: deviceToken },
          },
        }
      );

      await User.updateOne(
        { _id: user._id },
        {
          $push: {
            devices: {
              fcmToken: deviceToken,
              platform,
              deviceModel,
              timezone,
              lastUsed: new Date(),
            },
          },
        }
      );
    }

    // 4️⃣ توليد JWT
    const token = await generateJWT(user);

    // 5️⃣ حفظ التوكن فقط (بدون validation)
    await User.updateOne(
      { _id: user._id },
      { token }
    );

    // 6️⃣ إرسال المستخدم بدون كلمة مرور
    const userData = await User.findById(user._id).select("-password");

    res.status(200).json({
      status: "success",
      message: "تم تسجيل الدخول بنجاح",
      user: userData,
    });
  } catch (err) {
    next(err);
  }
};




const register = asyncWrapper(async (req, res, next) => {
    const requestData = req.body;
    

    const ifUserExist = await User.findOne({ email: requestData.email }); // ✅ استخدام requestData
    console.log(ifUserExist);
    if (ifUserExist||ifUserExist!=null) {
     
        return res.status(400).json({ status: "FAIL",statusCode: 400,  message: "المستخدم مسجل بهذا البريد الإلكتروني بالفعل."}); 
    }
    console.log('ifUserExist  :', ifUserExist);
    const user =  User({ 
        name: requestData.name,
        email: requestData.email,
        password: requestData.password, // ✅ استخدام كلمة المرور الخام (سيتم تشفيرها في الموديل)
        phone_number: requestData.phone_number,
        role: requestData.role||'student', // تعيين دور افتراضي إذا لم يتم توفيره
        gender: requestData.gender,
        country_code: requestData.country_code,
    });
  
    const token = await generateJWT(user); // ✅ افتراضياً لا تمرر next هنا
    user.token = token;
    
    // 4. تجهيز الاستجابة (حذف كلمة المرور)
    const userObj = user.toObject();
    delete userObj.password; 
    await user.save();
    // 5. إرسال استجابة النجاح
    res.status(201).json({ 
        status: httpStatus.SUCCESS,
        message: "تم التسجيل بنجاح.",
        statusCode: 201, 
        user: userObj, 
    });
  return;
});

const logOut = async (req, res, next) => {
    const userId = req.user._id; // افترض أن معرف المستخدم متاح في req.user

    // تحديث حقل التوكن ليكون فارغًا
  const user =  await User.findByIdAndUpdate(userId, { token: "" }, { new: true });
console.log('user after logout:',user);
  return  res.status(200).json({
      statusCode: 200,
        status: "success",
        message: "تم تسجيل الخروج بنجاح.",
    });
}; 
module.exports = {
  login,
  register,
  logOut
};
