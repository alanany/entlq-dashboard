const fs = require('fs');
const path = require('path');

const i18nMiddleware = (req, res, next) => {
    // 1. Get language from cookie, default to 'ar'
    const lang = req.cookies.lang || 'ar';
    
    // 2. Load translation file
    let translations = {};
    try {
        const localePath = path.join(__dirname, '..', 'locales', `${lang}.json`);
        const fileContent = fs.readFileSync(localePath, 'utf8');
        translations = JSON.parse(fileContent);
    } catch (err) {
        console.error(`Could not load translations for ${lang}:`, err.message);
    }

    // 3. Provide translation helper to EJS
    res.locals.t = (key) => translations[key] || key;
    res.locals.currentLang = lang;
    res.locals.dir = lang === 'ar' ? 'rtl' : 'ltr';

    next();
};

module.exports = i18nMiddleware;
