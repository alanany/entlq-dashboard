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

module.exports = { requireAuth, checkUser };