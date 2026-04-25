const { Router } = require('express');
const { checkUser, requireAuth } = require('../middleware/authMiddleware');
const courseController = require('../controllers/courseController');
const studentdashboardRoutes = Router();
const studentController = require('../controllers/studentController');
studentdashboardRoutes.get('/', checkUser, courseController.getCompanyLanding);
studentdashboardRoutes.get('/academy', checkUser, courseController.getLandingPage);
studentdashboardRoutes.get('/landing', checkUser, courseController.getLandingPageForDashboard);

studentdashboardRoutes.get('/dashboard',requireAuth,checkUser, studentController.getstudentDashboard);
studentdashboardRoutes.get('/student/register', studentController.signup_get);
studentdashboardRoutes.get('/student/login', studentController.login_get);
studentdashboardRoutes.post('/student/login', studentController.login_student);
studentdashboardRoutes.post('/student/register/public', studentController.registerStudent);

studentdashboardRoutes.get('/student/courses_list', requireAuth, checkUser, studentController.getAllCourses);
studentdashboardRoutes.get('/student/courses_list/:studentId', requireAuth, checkUser, studentController.getAllCoursesForAdminAutoSubscription);

studentdashboardRoutes.get('/student/book_plan/:id', requireAuth, checkUser, studentController.getBookPlan);
studentdashboardRoutes.get('/student/book_plan/:id/:studentId', requireAuth, checkUser, studentController.getAutoAdminBookPlan);
studentdashboardRoutes.get('/home', courseController.home_website_get);
studentdashboardRoutes.get('/website-courses', courseController.allCourses_website_get);
studentdashboardRoutes.get('/website-course/:id', courseController.getCourseDetails);
studentdashboardRoutes.post('/student/checkout',checkUser,requireAuth, courseController.checkout);
studentdashboardRoutes.get('/success',checkUser,requireAuth, studentController.getSucessSubscriptionPage);
studentdashboardRoutes.get('/student/enrolled_subscription',checkUser,requireAuth, studentController.getEnrolledSubscription);

studentdashboardRoutes.get('/request-details/:requestId',checkUser,requireAuth, studentController.getRequestDetails);
studentdashboardRoutes.get('/student/session-details/:bookingId/:sessionId',checkUser,requireAuth, studentController.getSessionWaitingRoom);
studentdashboardRoutes.get('/student/my-sessions',checkUser,requireAuth, studentController.getMySessionsPage);
studentdashboardRoutes.get('/student/student-sessions/:id',checkUser,requireAuth, studentController.getStudentSessionsPage);
studentdashboardRoutes.get('/student/settings', requireAuth, checkUser, studentController.getStudentSettings);
studentdashboardRoutes.get('/student/billing',checkUser,requireAuth, studentController.getStudentBillingPage);
studentdashboardRoutes.post('/settings/update-profile',checkUser,requireAuth, studentController.update_profile);
studentdashboardRoutes.post('/settings/update-password',checkUser,requireAuth, studentController.updatePassword);
studentdashboardRoutes.get('/student/profile',checkUser,requireAuth, studentController.getProfilePage);
// إضافة طالب جديد (من لوحة التحكم)
studentdashboardRoutes.post('/student/register', checkUser, requireAuth, studentController.addStudent);

// تغيير حالة الطالب (أرشفة / تنشيط)
studentdashboardRoutes.post('/student/update-status', checkUser, requireAuth, studentController.toggleStatus);

studentdashboardRoutes.get('/student/debug-expire', requireAuth, checkUser, studentController.debugExpireSubscription);

// حذف الطالب نهائياً
studentdashboardRoutes.get('/admin/student/profile/:id',checkUser,requireAuth, studentController.getStudentProfilePage);

studentdashboardRoutes.post('/student/delete/:id', checkUser, requireAuth, studentController.deleteStudent);

module.exports = studentdashboardRoutes;