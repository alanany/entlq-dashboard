require('dotenv').config();
const express = require('express');
const authRoutes = require('./routes/authRoutes');
const cookieParser = require('cookie-parser');
const {  checkUser } = require('./middleware/authMiddleware');
const connectMango = require('./middleware/mongo_connect');
const bodyParser = require('body-parser');
const { globalLimiter, authLimiter } = require('./middleware/rateLimiter');
const dashboardRoutes = require('./routes/dashboardRoutes');
const studentDashboardRoutes = require('./routes/studentDashboardRoutes');
const ApiCoursesRouter = require('./routes/api routes/api_coursesRoutes ');
const path = require('path');
const methodOverride = require('method-override');
const ApiAuthRouter = require('./routes/api routes/api_authRoutes');
const ApiChatRouter = require('./routes/api routes/api_chatRoutes');
const teacherDashboardRoutes = require('./routes/teacher_dashboard_routes');
const supervisorRoutes = require('./routes/supervisorRoutes');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

const app = express();

// 1. Security Headers (Protection against XSS, Clickjacking, etc.)
app.use(helmet({
    contentSecurityPolicy: false, // Disabled for easier integration with EJS/CDNs, can be tuned later
}));

// 2. Data Sanitization against NoSQL query injection
app.use(mongoSanitize());

// 3. Prevent HTTP Parameter Pollution
app.use(hpp());

// Apply global rate limiter to all requests (DDoS protection)
app.use(globalLimiter);

// Specific limiters for sensitive routes (Brute force protection)
app.use('/login', authLimiter);
app.use('/admin_register', authLimiter);
app.use('/api/v1', authLimiter); // Apply to all API auth routes

// ⭐️ الإعداد الصحيح لمجلد العرض ⭐️
// يتم تعيين مجلد 'views' كمسار افتراضي للـ EJS
app.set("views", path.join(__dirname, 'views'));

app.set("view engine", "ejs");
// 1. لتحليل البيانات القادمة بتنسيق JSON (مثل تطبيقات React/Mobile)

// 2. لتحليل البيانات القادمة من نماذج HTML (HTML Forms)
// middleware
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.json());
app.use(cookieParser());
const cors = require('cors');
app.use(cors());

const i18nMiddleware = require('./middleware/i18nMiddleware');

// i18n middleware
app.use(i18nMiddleware);

// Language switch route
app.get('/lang/:locale', (req, res) => {
    const locale = req.params.locale;
    res.cookie('lang', locale, { maxAge: 900000, httpOnly: true });
    res.redirect('back');
});

const multer = require('multer'); // ⭐️ استيراد Multer
// ⭐️ تعيين مجلد public للملفات الثابتة (CSS/JS/صور) ⭐️
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const http = require('http');
const socketIo = require('socket.io');
const chatSocket = require('./utility/chat_socket');

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
    origin: ["https://entlqsa.com"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
    }
});

chatSocket(io);

const port = process.env.PORT || 4000;
// database connection
(async () => {
    try {
        await connectMango();
        server.listen(port, () => {
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
app.use(supervisorRoutes);
app.use(teacherDashboardRoutes);
// api routes
app.use(ApiAuthRouter);
app.use(ApiCoursesRouter);
app.use(ApiChatRouter);

const chatRoutes = require('./routes/chatRoutes');
app.use(chatRoutes);
