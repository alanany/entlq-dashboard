const jwt = require('jsonwebtoken');
const User = require('../models/user_model');

const requireAuth = (req, res, next) => {
    const token = req.cookies.jwt;

    // check json web token exists & is verified
    if (token) {
        jwt.verify(token, '01115699209', (err, decodedToken) => {
            if (err) {
                // إذا كان الرمز غير صالح: تحويل إلى صفحة تسجيل الدخول
                console.log(err.message);
                res.redirect('/home');
            } else {
                // ⭐️ إذا كان الرمز صالحاً: نمرر الطلب فقط (next())
                console.log(decodedToken);
                // ❌ تم حذف: res.redirect('/login');
                next(); // ⭐️ هذا هو الإجراء الصحيح الوحيد ⭐️
            }
        });
    } else {
        // إذا لم يكن هناك رمز: تحويل إلى صفحة تسجيل الدخول
        res.redirect('/home');
    }
};

// ... (دالة checkUser تبقى كما هي، فهي صحيحة) ...
const checkUser = (req, res, next) => {
    const token = req.cookies.jwt;
    if (token) {
        jwt.verify(token, '01115699209', async (err, decodedToken) => {
            if (err) {
                res.locals.user = null;
                next();
            } else {
                let user = await User.findById(decodedToken.id);
                res.locals.user = user;
                console.log(res.locals.user);
                req.user = res.locals.user;
                next();
            }
        });
    } else {
        res.locals.user = null;
        next();
    }
};
const requireAdmin = (req, res, next) => {
    // 1. التأكد أولاً أن المستخدم مسجل دخول (بياناته موجودة في req.user)
    if (req.user) {
        // 2. التحقق من رتبة المستخدم (افترضنا أن الحقل اسمه role وقيمته admin)
        if (req.user.role === 'admin') {
            next(); // مستخدم أدمن، اسمح له بالمرور
        } else {
            // مستخدم مسجل دخول ولكنه ليس أدمن (مثلاً طالب أو معلم)
            res.status(403).send('غير مسموح لك بالدخول، هذه المنطقة للمسؤولين فقط');
            // أو يمكنك عمل redirect لصفحة معينة:
            // res.redirect('/home');
        }
    } else {
        // لا توجد بيانات مستخدم (غير مسجل دخول)
        res.redirect('/');
    }
};
module.exports = { requireAuth, checkUser, requireAdmin };