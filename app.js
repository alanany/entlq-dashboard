const express = require('express');
const authRoutes = require('./routes/authRoutes');
const cookieParser = require('cookie-parser');
const { requireAuth, checkUser } = require('./middleware/authMiddleware');
const connectMango = require('./middleware/mongo_connect');
const app = express();
const dashboardRoutes = require('./routes/dashboardRoutes');
const studentDashboardRoutes = require('./routes/studentDashboardRoutes');
// ⭐️ إضافة وحدة 'path' ⭐️
const path = require('path'); 
const methodOverride = require('method-override');

// ⭐️ الإعداد الصحيح لمجلد العرض ⭐️
// يتم تعيين مجلد 'views' كمسار افتراضي للـ EJS
app.set("views", path.join(__dirname, 'views')); 
app.set("view engine", "ejs");

// middleware
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.json());
app.use(cookieParser());

// ⭐️ تعيين مجلد public للملفات الثابتة (CSS/JS/صور) ⭐️
app.use(express.static(path.join(__dirname, 'public')));


const port = process.env.PORT || 4000;
// database connection
(async () => {
    try {
        await connectMango();
        app.listen(port, () => {
            console.log(`Server is running at http://localhost:${port}`);
        });
    } catch (err) {
        console.error("Startup aborted due DB connection failure:", err);
        process.exit(1);
    }
})();

// routes   
// check current user for all routes and get user for specific routes
app.get('*', checkUser);
app.use(authRoutes);
app.use(dashboardRoutes);
app.use(studentDashboardRoutes);