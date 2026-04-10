const jwt = require('jsonwebtoken');
const { AppDataSource } = require('../config/database');

const requireAuth = (req, res, next) => {
    const token = req.cookies.jwt;

    if (token) {
        jwt.verify(token, process.env.JWT_SECRET || '01115699209', (err, decodedToken) => {
            if (err) {
                console.log(err.message);
                res.redirect('/');
            } else {
                next();
            }
        });
    } else {
        res.redirect('/');
    }
};

const checkUser = (req, res, next) => {
    const token = req.cookies.jwt;
    const userRepository = AppDataSource.getRepository('User');
    const systemSettingsRepository = AppDataSource.getRepository('SystemSettings');

    if (token) {
        jwt.verify(token, process.env.JWT_SECRET || '01115699209', async (err, decodedToken) => {
            if (err) {
                res.locals.user = null;
                next();
            } else {
                let user;
                try {
                    user = await userRepository.findOne({ 
                        where: { id: parseInt(decodedToken.id) }, 
                        relations: ['academy'] 
                    });
                } catch (e) {
                    console.error("Error fetching user in checkUser:", e.message);
                }

                res.locals.user = user;
                let settings = null;

                if (user && user.academy) {
                    req.user = user;
                    req.user.academyId = user.academy.id; // Compatibility mapping 
                    
                    settings = await systemSettingsRepository.findOne({ 
                        where: { academy: { id: user.academy.id } } 
                    });
                    if (!settings) {
                        settings = systemSettingsRepository.create({ 
                            academy: { id: user.academy.id },
                            academyName: user.academy.name
                        });
                        await systemSettingsRepository.save(settings);
                    }
                } else if (user) {
                    req.user = user;
                }

                res.locals.settings = settings || {};

                res.locals.getImageUrl = (imagePath, fallback = '/img/classes-1.jpg') => {
                    if (!imagePath || imagePath.trim() === '') return fallback;
                    if (imagePath.startsWith('http')) return imagePath;
                    const protocol = req.protocol;
                    const host = req.get('host');
                    const domain = `${protocol}://${host}`;
                    return imagePath.startsWith('/') ? `${domain}${imagePath}` : `${domain}/${imagePath}`;
                };

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
            }
        });
    } else {
        res.locals.user = null;
        systemSettingsRepository.findOne({ where: {} }).then(settings => {
            res.locals.settings = settings || {};
            
            res.locals.getImageUrl = (imagePath, fallback = '/img/classes-1.jpg') => {
                if (!imagePath || imagePath.trim() === '') return fallback;
                if (imagePath.startsWith('http')) return imagePath;
                const protocol = req.protocol;
                const host = req.get('host');
                const domain = `${protocol}://${host}`;
                return imagePath.startsWith('/') ? `${domain}${imagePath}` : `${domain}/${imagePath}`;
            };

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
    }
};

const requireAdmin = (req, res, next) => {
    if (req.user) {
        if (req.user.role === 'admin' || req.user.role === 'supervisor' || req.user.role === 'superadmin') {
            next();
        } else {
            res.status(403).send('غير مسموح لك بالدخول، هذه المنطقة للمسؤولين فقط');
        }
    } else {
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