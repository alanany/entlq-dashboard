const { Router } = require('express');
const { checkUser, requireAuth } = require('../middleware/authMiddleware');
const courseController = require('../controllers/courseController');
const studentdashboardRoutes = Router();
const studentController = require('../controllers/studentController');
studentdashboardRoutes.get('/',requireAuth,checkUser, studentController.getstudentDashboard);
studentdashboardRoutes.get('/student/register', studentController.signup_get);
studentdashboardRoutes.get('/student/login', studentController.login_get);
studentdashboardRoutes.post('/student/login', studentController.login_student);
studentdashboardRoutes.post('/student/register', studentController.registerStudent);

studentdashboardRoutes.get('/student/courses_list', studentController.getAllCourses);
studentdashboardRoutes.get('/student/book_plan/:id', studentController.getBookPlan);
studentdashboardRoutes.get('/home', courseController.home_website_get);
studentdashboardRoutes.get('/website-courses', courseController.allCourses_website_get);
studentdashboardRoutes.get('/website-course/:id',checkUser,requireAuth, courseController.getCourseDetails);
studentdashboardRoutes.post('/student/checkout',checkUser,requireAuth, courseController.checkout);
studentdashboardRoutes.get('/success',checkUser,requireAuth, studentController.getSucessSubscriptionPage);
studentdashboardRoutes.get('/student/enrolled_subscription',checkUser,requireAuth, studentController.getEnrolledSubscription);

studentdashboardRoutes.get('/request-details/:requestId',checkUser,requireAuth, studentController.getRequestDetails);
studentdashboardRoutes.get('/student/session-details/:bookingId/:sessionId',checkUser,requireAuth, studentController.getSessionWaitingRoom);
studentdashboardRoutes.get('/student/my-sessions',checkUser,requireAuth, studentController.getMySessionsPage);

studentdashboardRoutes.get('/student/settings',checkUser,requireAuth, studentController.getStudentSettings);
studentdashboardRoutes.get('/student/billing',checkUser,requireAuth, studentController.getStudentBillingPage);
module.exports = studentdashboardRoutes;