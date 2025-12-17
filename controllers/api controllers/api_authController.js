const User = require("../../models/user_model");
const bcrypt = require("bcryptjs");
const httpStatus = require("../../utility/http_status");
const AppError = require("../../utility/app_error");
const asyncWrapper = require("../../middleware/async_wrapper");
const generateJWT = require("../../middleware/generate_jwt");


// handle errors

// controller actions

const login =asyncWrapper( async (req, res,next) => {
    const requestData = req.body;


  const { email, password, role } = requestData; // ⬅️ استقبال البيانات من Query Parameters

  // **كائن الأخطاء المخصص**
  
console.log('requestData',requestData);
 
    // 2. البحث عن المستخدم بالبريد والدور
    const user = await User.findOne({ email: email, role: role });

    if (!user) {
      // 3. حالة: المستخدم غير موجود (البريد غير صحيح)
     const NativeError = "هذا البريد الإلكتروني غير صحيح";
       return res.status(401).json({ message: NativeError,
        statusCode: "FAILL",
        status: 401,});

    }

    // 4. إذا تم العثور على المستخدم، مقارنة كلمة المرور
    const auth =  bcrypt.compareSync(password, user.password);

    if (!auth) {
      // 5. حالة: كلمة المرور غير صحيحة
     const NativeError = "كلمة المرور المدخلة غير صحيحة";
      return res.status(401).json({ message: NativeError,
        statusCode: "FAILL",
        status: 401,});
    }

    // 6. حالة النجاح: كلمة المرور صحيحة
  
    //update token in database

    const token = await generateJWT(user); // ✅ افتراضياً لا تمرر next هنا
    user.token = token;
      await user.save();
    // 4. تجهيز الاستجابة (حذف كلمة المرور)
    const userObj = user.toObject();
    delete userObj.password; 
  


    // إرسال استجابة النجاح
    res.status(200).json({
      statusCode: 200,
      status: "success",
      message: "تم تسجيل الدخول بنجاح.",
      user: userObj,
    });
    return; // ⭐️ إيقاف التنفيذ بعد إرسال الاستجابة
});

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
        data: { 
            user: userObj,
      
        } 
    });

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
