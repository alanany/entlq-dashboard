const rateLimit = require('express-rate-limit');

// General rate limiter for all requests
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 200 requests per windowMs
    message: {
        status: 429,
        message: "لقد تجاوزت عدد المحاولات المسموح بها، يرجى المحاولة مرة أخرى بعد 15 دقيقة."
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Stricter limiter for authentication routes (login/register)
const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    message: {
        status: 429,
        message: "محاولات كثيرة جداً للدخول، يرجى الانتظار 10 دقائق قبل المحاولة مرة أخرى."
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    globalLimiter,
    authLimiter
};
