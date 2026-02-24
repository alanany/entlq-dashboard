const User = require("../models/user_model");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Course = require('../models/course_model.js');
const Academy = require('../models/academy_model');
// handle errors
const handleErrors = (err) => {
  console.log(err.message, err.code);
  let errors = { email: '', password: '' };

  // incorrect email
  if (err.message === 'incorrect email') {
    errors.email = 'That email is not registered';
  }

  // incorrect password
  if (err.message === 'incorrect password') {
    errors.password = 'That password is incorrect';
  }

  // duplicate email error
  if (err.code === 11000) {
    errors.email = 'that email is already registered';
    return errors;
  }

  // validation errors
  if (err.message.includes('user validation failed')) {
    // console.log(err);
    Object.values(err.errors).forEach(({ properties }) => {
      // console.log(val);
      // console.log(properties);
      errors[properties.path] = properties.message;
    });
  }

  return errors;
}

// create json web token
const maxAge = 3 * 24 * 60 * 60;
const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: maxAge
  });
};

// controller actions
module.exports.signup_get = (req, res) => {
  res.render('../views/dashboard/admin_register');
}

module.exports.login_get = (req, res) => {
  res.render('../views/dashboard/login');
}

module.exports.signup_post = async (req, res) => {
  const { email, password, name, role, academyId } = req.body;
console.log(req.body);
  try {
    const user = await User.create({ email, password, name, role, academyId });
    console.log(user);
    const token =  createToken(user._id);
    console.log(token);
    await res.cookie('jwt', token, { httpOnly: true, maxAge: maxAge * 1000 });
    res.status(200).json({user: user._id});

   
  }
  catch(err) {
    const errors = handleErrors(err);
    console.log(errors);
 res.status(400).json({ errors });
  }
 
}

module.exports.login_post = async (req, res) => {
    console.log(req.body);

    // 1. استخراج البيانات المطلوبة
    const { email, password, role ,timezone} = req.body;
    const normalizedEmail = email ? email.trim().toLowerCase() : '';
    
    // **كائن الأخطاء المخصص**
    let errors = {}; 

    try {
        // 2. البحث عن المستخدم بالبريد والدور
        const user = await User.findOne({ email: normalizedEmail, role: role });

        if (!user) {
            // 3. حالة: المستخدم غير موجود (البريد غير صحيح)
            errors.email = 'هذا البريد الإلكتروني غير صحيح';
            res.status(400).json({ errors });
            return; // ⭐️ إيقاف التنفيذ بعد إرسال الاستجابة
        }

        // 4. إذا تم العثور على المستخدم، مقارنة كلمة المرور
        const auth = await bcrypt.compare(password, user.password);
        
        if (!auth) {
            // 5. حالة: كلمة المرور غير صحيحة
            errors.password = 'كلمة المرور المدخلة غير صحيحة';
            res.status(400).json({ errors });
            return; // ⭐️ إيقاف التنفيذ بعد إرسال الاستجابة
        } 

        // 5.5 تحقق من حالة الأكاديمية (إذا كان المستخدم مرتبطاً بأكاديمية)
        if (user.academyId) {
            const academy = await Academy.findById(user.academyId).populate('academyId');
            if (academy && academy.status === 'suspended') {
                errors.email = 'تم حظر هذه الأكاديمية مؤقتاً. يرجى التواصل مع الإدارة.';
                res.status(403).json({ errors });
                return;
            }
        }

        if (timezone && user.timezone !== timezone) {
    user.timezone = timezone;
    await user.save();
    console.log(`تم تحديث توقيت المستخدم إلى: ${timezone}`);
}
        // 6. حالة النجاح: كلمة المرور صحيحة
        const token = createToken(user._id);
        await res.cookie('jwt', token, { httpOnly: true, maxAge: maxAge * 1000 });
        
        // إرسال استجابة النجاح
        res.status(200).json({ user: user._id, role: user.role, message: "تم تسجيل الدخول بنجاح." });
        return; // ⭐️ إيقاف التنفيذ بعد إرسال الاستجابة

    } 
    catch (err) {
        // 7. التقاط أخطاء الخادم العامة أو أخطاء قاعدة البيانات
        console.error(err);
        
        // استخدام دالة handleErrors لمعالجة الأخطاء غير المتوقعة (مثل خطأ في الخادم)
        const specificErrors = handleErrors(err); 
        res.status(400).json({ errors: specificErrors });
        return; // ⭐️ إيقاف التنفيذ
    }
}

module.exports.logout_get = (req, res) => {
  res.cookie('jwt', '', { maxAge: 1 });
  res.redirect('/');
}
module.exports.student_logout_get = (req, res) => {
  res.cookie('jwt', '', { maxAge: 1 });
  res.redirect('/landing');
}