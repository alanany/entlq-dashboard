const AppError = require("../utility/app_error");
const httpStatus = require("../utility/http_status");
const { default: isEmail } = require("validator/lib/isEmail"); // 💡 استيراد دالة isEmail

// ⭐️ دالة المصنع: تقبل قائمة الحقول الإلزامية
const validationAnyRequestExpect = (requiredFields = []) => {
  return (req, res, next) => {
    const requestData = req.body || {};
    console.log("validationAnyRequestExpect", requestData);
    const errors = [];
    const MIN_PASSWORD_LENGTH = 6;

    // 1️⃣ تحقق من الحقول الإلزامية
    for (const field of requiredFields) {
      const value = requestData[field];

      if (!value || (typeof value === "string" && value.trim() === "")) {
        errors.push({
          field,
          message: `حقل ${field} مطلوب ولا يمكن أن يكون فارغاً`,
        });
        console.log("errors", errors);
        continue; // لو مفيش قيمة، نكمل للحقول الأخرى
      }

      // 2️⃣ تحقق خاص بالبريد الإلكتروني
      if (field === "email" && !isEmail(value.toString())) {
        errors.push({
          field,
          message: `يجب إدخال بريد إلكتروني صالح.`,
        });
      }

      // 3️⃣ تحقق خاص بكلمة المرور
      if (field === "password" && value.length < MIN_PASSWORD_LENGTH) {
        errors.push({
          field,
          message: `كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل.`,
        });
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        status: "fail",
        message: "خطأ في بيانات الإدخال",
        errors: errors,
      });
    }

    next();
  };
};

module.exports = { validationAnyRequestExpect };
