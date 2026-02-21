const jwt = require('jsonwebtoken');
const User = require('../models/user_model');
const SystemSettings = require('../models/SystemSettings');

const requireAuth = (req, res, next) => {
    const token = req.cookies.jwt;

    // check json web token exists & is verified
    if (token) {
        jwt.verify(token, process.env.JWT_SECRET || '01115699209', (err, decodedToken) => {
            if (err) {
                // إذا كان الرمز غير صالح: تحويل إلى صفحة تسجيل الدخول
                console.log(err.message);
                res.redirect('/');
            } else {
                // ⭐️ إذا كان الرمز صالحاً: نمرر الطلب فقط (next())
                console.log(decodedToken);
                // ❌ تم حذف: res.redirect('/login');
                next(); // ⭐️ هذا هو الإجراء الصحيح الوحيد ⭐️
            }
        });
    } else {
        // إذا لم يكن هناك رمز: تحويل إلى صفحة تسجيل الدخول
        res.redirect('/');
    }
};

// ... (دالة checkUser تبقى كما هي، فهي صحيحة) ...
const checkUser = (req, res, next) => {
    const token = req.cookies.jwt;
    if (token) {
        jwt.verify(token, process.env.JWT_SECRET || '01115699209', async (err, decodedToken) => {
            if (err) {
                res.locals.user = null;
                next();
            } else {
                let user = await User.findById(decodedToken.id).populate('academyId');
                res.locals.user = user;
                
                // جلب إعدادات النظام وتوفيرها عالمياً للأكاديمية الحالية
                let settings = await SystemSettings.findOne({ academyId: user.academyId });
                if (!settings && user.academyId) {
                    settings = await SystemSettings.create({ 
                        academyId: user.academyId,
                        academyName: user.academyId.name
                    });
                }
                res.locals.settings = settings || {};

                // Helper to format image URLs
                res.locals.getImageUrl = (imagePath, fallback = '/img/classes-1.jpg') => {
                    if (!imagePath || imagePath.trim() === '') return fallback;
                    if (imagePath.startsWith('http')) return imagePath;
                    const protocol = req.protocol;
                    const host = req.get('host');
                    const domain = `${protocol}://${host}`;
                    return imagePath.startsWith('/') ? `${domain}${imagePath}` : `${domain}/${imagePath}`;
                };

                // ====== Helper لتنسيق العملة ======
                // الاستخدام في EJS: <%= formatCurrency(booking.totalAmount) %>
                res.locals.formatCurrency = (amount, opts = {}) => {
                    const s = settings || {};
                    const symbol   = opts.symbol   || s.currencySymbol  || s.currency || 'ر.س';
                    const position = opts.position || s.currencyPosition || 'after';
                    const decimals = opts.decimals !== undefined ? opts.decimals : 0;
                    const num = Number(amount);
                    if (isNaN(num)) return `- ${symbol}`;
                    const formatted = num.toLocaleString('ar-EG', {
                        minimumFractionDigits: decimals,
                        maximumFractionDigits: decimals
                    });
                    return position === 'before' ? `${symbol}${formatted}` : `${formatted} ${symbol}`;
                };

                // رمز العملة فقط (للاستخدام السريع في القوالب)
                res.locals.currencySymbol = settings?.currencySymbol || settings?.currency || 'ر.س';

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
                const protocol = req.protocol;
                const host = req.get('host');
                const domain = `${protocol}://${host}`;
                return imagePath.startsWith('/') ? `${domain}${imagePath}` : `${domain}/${imagePath}`;
            };

            // ====== Helper لتنسيق العملة (للزوار غير المسجلين) ======
            res.locals.formatCurrency = (amount, opts = {}) => {
                const s = settings || {};
                const symbol   = opts.symbol   || s.currencySymbol  || s.currency || 'ر.س';
                const position = opts.position || s.currencyPosition || 'after';
                const decimals = opts.decimals !== undefined ? opts.decimals : 0;
                const num = Number(amount);
                if (isNaN(num)) return `- ${symbol}`;
                const formatted = num.toLocaleString('ar-EG', {
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals
                });
                return position === 'before' ? `${symbol}${formatted}` : `${formatted} ${symbol}`;
            };
            res.locals.currencySymbol = settings?.currencySymbol || settings?.currency || 'ر.س';

            next();
        }).catch(err => {
            res.locals.settings = {};
            res.locals.formatCurrency = (amount) => `${Number(amount) || 0} ر.س`;
            res.locals.currencySymbol = 'ر.س';
            next();
        });
        return;
    }
};
const requireAdmin = (req, res, next) => {
    // 1. التأكد أولاً أن المستخدم مسجل دخول (بياناته موجودة في req.user)
    if (req.user) {
        // 2. التحقق من رتبة المستخدم (أدمن أو مشرف)
        if (req.user.role === 'admin' || req.user.role === 'supervisor' || req.user.role === 'superadmin') {
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

const requireSuperAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'superadmin') {
        next();
    } else {
        res.status(403).send('غير مسموح لك بالدخول، هذه المنطقة للمدير العام فقط');
    }
};

module.exports = { requireAuth, checkUser, requireAdmin, requireSuperAdmin };