const { Router } = require('express');
const { checkUser, requireAuth } = require('../middleware/authMiddleware');
const teacherdashboardRoutes = Router();
const teacherController = require('../controllers/teacher_controller');
const {validationAnyRequestExpect} = require("../validation/validation");
teacherdashboardRoutes.get('/teacher/register', teacherController.signup_get);
teacherdashboardRoutes.get('/teacher/login', teacherController.login_get);
teacherdashboardRoutes.post('/teacher/login', teacherController.loginTeacher);
teacherdashboardRoutes.post('/teacher/register',validationAnyRequestExpect(['name','password','phone_number','country_code','email','gender']), teacherController.registerTeacher);
teacherdashboardRoutes.get('/teacher/home',checkUser,requireAuth, teacherController.teacherHome);
teacherdashboardRoutes.get('/teacher/calendar/:id',checkUser,requireAuth, teacherController.getTeacherCalendarPage);

// 2. مسار جلب بيانات الحصص (JSON) للتقويم
teacherdashboardRoutes.get('/teacher/events/:id',checkUser,requireAuth, teacherController.getTeacherEvents);
teacherdashboardRoutes.get('/teacher/schedule',checkUser,requireAuth, teacherController.getSchedule);
 teacherdashboardRoutes.get('/teacher/schedule/:id',checkUser,requireAuth, teacherController.getAdminScheduleTeacher);

teacherdashboardRoutes.get('/teacher/session/:bookingId/:sessionIndex',checkUser,requireAuth,  teacherController.getSessionPage);
teacherdashboardRoutes.post('/teacher/save-session-report',checkUser,requireAuth, teacherController.saveSessionReport);
teacherdashboardRoutes.get('/teacher/finanical_page',checkUser,requireAuth, teacherController.finanical_page);
teacherdashboardRoutes.get('/teacher/settings',checkUser,requireAuth, teacherController.settings_page);
teacherdashboardRoutes.post('/teacher/update',checkUser,requireAuth, teacherController.postUpdateProfile);
teacherdashboardRoutes.get('/teacher/students',checkUser,requireAuth, teacherController.studentGetpage);
teacherdashboardRoutes.get('/teacher/student/profile/:id',checkUser,requireAuth, teacherController.getStudentProfile);
teacherdashboardRoutes.get('/teacher/change-password',checkUser,requireAuth, teacherController.changePasswordPage);
teacherdashboardRoutes.post('/teacher/change-password',checkUser,requireAuth, teacherController.changePassword);

module.exports = teacherdashboardRoutes;