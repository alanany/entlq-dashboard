const { Router } = require('express');
const { checkUser, requireAuth } = require('../middleware/authMiddleware');
const teacherdashboardRoutes = Router();
const teacherController = require('../controllers/teacher_controller');

teacherdashboardRoutes.get('/teacher/register', teacherController.signup_get);
teacherdashboardRoutes.get('/teacher/login', teacherController.login_get);
teacherdashboardRoutes.post('/teacher/login', teacherController.loginTeacher);
teacherdashboardRoutes.post('/teacher/register', teacherController.registerTeacher);
teacherdashboardRoutes.get('/teacher/home',checkUser,requireAuth, teacherController.teacherHome);
teacherdashboardRoutes.get('/teacher/calendar/:id',checkUser,requireAuth, teacherController.getTeacherCalendarPage);

// 2. مسار جلب بيانات الحصص (JSON) للتقويم
teacherdashboardRoutes.get('/teacher/events/:id',checkUser,requireAuth, teacherController.getTeacherEvents);
teacherdashboardRoutes.get('/teacher/schedule',checkUser,requireAuth, teacherController.getSchedule);
// routes/teacher.js
teacherdashboardRoutes.get('/teacher/session/:bookingId/:sessionIndex',checkUser,requireAuth,  teacherController.getSessionPage);
teacherdashboardRoutes.post('/teacher/save-session-report',checkUser,requireAuth, teacherController.saveSessionReport);
teacherdashboardRoutes.get('/teacher/finanical_page',checkUser,requireAuth, teacherController.finanical_page);
teacherdashboardRoutes.get('/teacher/settings',checkUser,requireAuth, teacherController.settings_page);
teacherdashboardRoutes.post('/teacher/update',checkUser,requireAuth, teacherController.postUpdateProfile);
module.exports = teacherdashboardRoutes;