const jwt = require('jsonwebtoken');
const User = require('../models/user_model');
const SystemSettings = require('../models/SystemSettings');

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
                
                // جلب إعدادات النظام وتوفيرها عالمياً
                let settings = await SystemSettings.findOne();
                if (!settings) {
                    settings = await SystemSettings.create({});
                }
                res.locals.settings = settings;

                // Helper to format image URLs
                res.locals.getImageUrl = (imagePath, fallback = '/img/classes-1.jpg') => {
                    if (!imagePath || imagePath.trim() === '') return fallback;
                    if (imagePath.startsWith('http')) return imagePath;
                    // Prepend domain if it's an upload path (useful for local dev or when files are moved)
                    // The user explicitly requested to use entlqsa.com
                    const domain = 'https://entlqsa.com';
                    return imagePath.startsWith('/') ? `${domain}${imagePath}` : `${domain}/${imagePath}`;
                };

                console.log(res.locals.user);
                req.user = res.locals.user;
                next();
            }
        });
    } else {
        res.locals.user = null;
        // جلب إعدادات النظام حتى لغير المسجلين
        SystemSettings.findOne().then(settings => {
            if (!settings) return SystemSettings.create({});
            return settings;
        }).then(settings => {
            res.locals.settings = settings;
            
            // Helper to format image URLs
            res.locals.getImageUrl = (imagePath, fallback = '/img/classes-1.jpg') => {
                if (!imagePath || imagePath.trim() === '') return fallback;
                if (imagePath.startsWith('http')) return imagePath;
                const domain = 'https://entlqsa.com';
                return imagePath.startsWith('/') ? `${domain}${imagePath}` : `${domain}/${imagePath}`;
            };

            next();
        }).catch(err => {
            res.locals.settings = {};
            next();
        });
        return;
    }
};
const requireAdmin = (req, res, next) => {
    // 1. التأكد أولاً أن المستخدم مسجل دخول (بياناته موجودة في req.user)
    if (req.user) {
        // 2. التحقق من رتبة المستخدم (أدمن أو مشرف)
        if (req.user.role === 'admin' || req.user.role === 'supervisor') {
            next(); // مستخدم أدمن أو مشرف، اسمح له بالمرور
        } else {
            // مستخدم مسجل دخول ولكنه ليس أدمن أو مشرف
            res.status(403).send('غير مسموح لك بالدخول، هذه المنطقة للمسؤولين فقط');
        }
    } else {
        // لا توجد بيانات مستخدم (غير مسجل دخول)
        res.redirect('/');
    }
};
module.exports = { requireAuth, checkUser, requireAdmin };