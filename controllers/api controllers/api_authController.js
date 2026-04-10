const bcrypt = require("bcryptjs");
const httpStatus = require("../../utility/http_status");
const AppError = require("../../utility/app_error");
const asyncWrapper = require("../../middleware/async_wrapper");
const generateJWT = require("../../middleware/generate_jwt");
const { AppDataSource } = require('../../config/database');

const login = async (req, res, next) => {
  try {
    const {
      email,
      password,
      deviceToken,
      platform = "android",
      deviceModel,
      timezone,
    } = req.body;

    const userRepository = AppDataSource.getRepository('User');
    const academyRepository = AppDataSource.getRepository('Academy');

    // 1️⃣ جلب المستخدم (كلمة المرور مطلوبة)
    const normalizedEmail = email ? email.trim().toLowerCase() : '';
    // select must include password explicitly since it should be selected. Wait, TypeORM loads it by default unless select:false in schema.
    const user = await userRepository.findOne({ 
      where: { email: normalizedEmail },
      relations: ['academy']
    });

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

    // 2.5️⃣ تحقق من حالة الأكاديمية
    if (user.academy) {
        if (user.academy.status === 'suspended') {
            return res.status(403).json({
                status: "fail",
                message: "تم حظر هذه الأكاديمية مؤقتاً. يرجى التواصل مع الإدارة.",
            });
        }
    }

    let devices = user.devices || [];

    // 3️⃣ إضافة / تحديث الجهاز (بدون save)
    if (deviceToken && platform !== "web") {
      // Remove old token instance if exists
      devices = devices.filter(d => d.fcmToken !== deviceToken);
      
      // Push new
      devices.push({
          fcmToken: deviceToken,
          platform,
          deviceModel,
          timezone,
          lastUsed: new Date()
      });
      user.devices = devices;
    }

    // 4️⃣ توليد JWT
    // generateJWT might expect _id. Map user._id to user.id inside generate_jwt if needed, or pass the id.
    user._id = user.id; // temporary polyfill for generator
    const token = await generateJWT(user);
    user.token = token;

    // 5️⃣ حفظ التوكن فقط (بدون validation) - We save the updated token and devices
    await userRepository.save(user);

    // 6️⃣ إرسال المستخدم بدون كلمة مرور
    const { password: userPassword, ...userData } = user;

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
    const userRepository = AppDataSource.getRepository('User');

    const normalizedEmail = requestData.email ? requestData.email.trim().toLowerCase() : '';

    const ifUserExist = await userRepository.findOne({ where: { email: normalizedEmail } }); 
    if (ifUserExist) {
        return res.status(400).json({ status: "FAIL", statusCode: 400, message: "المستخدم مسجل بهذا البريد الإلكتروني بالفعل."}); 
    }
    
    const hashedPassword = await bcrypt.hash(requestData.password, 10);

    const user = userRepository.create({ 
        name: requestData.name,
        email: normalizedEmail,
        password: hashedPassword,
        phone_number: requestData.phone_number,
        role: requestData.role || 'student', 
        gender: requestData.gender,
        country_code: requestData.country_code,
    });
  
    await userRepository.save(user);

    user._id = user.id; // polyfill for JWT gen
    const token = await generateJWT(user); 
    user.token = token;
    
    await userRepository.save(user);
    
    // 4. تجهيز الاستجابة (حذف كلمة المرور)
    const { password, ...userObj } = user;
    
    // 5. إرسال استجابة النجاح
    res.status(201).json({ 
        status: httpStatus.SUCCESS,
        message: "تم التسجيل بنجاح.",
        statusCode: 201, 
        user: userObj, 
    });
});

const logOut = async (req, res, next) => {
    const userId = req.user.id || req.user._id; 
    const userRepository = AppDataSource.getRepository('User');

    // تحديث حقل التوكن ليكون فارغًا
    await userRepository.update(userId, { token: "" });

    return res.status(200).json({
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
