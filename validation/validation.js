const AppError = require("../utility/app_error");
const httpStatus = require("../utility/http_status");
const { default: isEmail } = require("validator/lib/isEmail"); // 💡 استيراد دالة isEmail
// ⭐️ دالة المصنع: تقبل قائمة الحقول الاختيارية
const validationAnyRequestExpect = (optionalFields = []) => {
  // ⭐️ الدالة الفعلية لـ Middleware
  return (req, res, next) => {
    const requestData = req.body;
    console.log("validationAnyRequestExpect",requestData);
    const errors = [];
    const MIN_PASSWORD_LENGTH = 6; // 💡 تعريف الحد الأدنى
    for (const key of Object.keys(requestData)) {
      const value = requestData[key];

      // 1. استخدام قائمة optionalFields التي تم تمريرها
      if (optionalFields.includes(key)) {
        continue;
      }
      // 3. ⭐️ التحقق الخاص بكلمة المرور
      if (key === "password" && value.length < MIN_PASSWORD_LENGTH) {
        errors.push({
          field: key,
          message: `كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل.`,
        });
      }

      // 4. ⭐️ التحقق الخاص بالبريد الإلكتروني
      if (key === "email" && !isEmail(value.toString())) {
        errors.push({
          field: key,
          message: `يجب إدخال بريد إلكتروني صالح.`,
        });
      }
      // 2. التحقق من القيمة
      if (!value || (typeof value === "string" && value.trim() === "")) {
        errors.push({
          field: key,
          message: `حقل ${key} مطلوب ولا يمكن أن يكون فارغاً`,
        });
      }
    }

    if (errors.length > 0|| !requestData || Object.keys(requestData).length === 0) {
      return res.status(400).json({
        status: "fail",
        message: "خطأ في بيانات الإدخال",
        errors: errors,
      });
    }

    return next();
  };
};

module.exports = { validationAnyRequestExpect };
