const { Router } = require('express');
const courseController = require('../controllers/courseController');
const { checkUser, requireAuth } = require('../middleware/authMiddleware');
const dashboardRoutes = Router();
const categoryController = require('../controllers/categoryController');
dashboardRoutes.get('/admin',requireAuth,checkUser, courseController.getAdminDashboard);

//dashboardRoutes.get('/',requireAuth,checkUser, courseController.getAdminDashboard);
dashboardRoutes.get('/addCourse',requireAuth,checkUser, courseController.getAddCourse);
dashboardRoutes.post('/addCourse-post',requireAuth,checkUser, courseController.addCourse);
dashboardRoutes.get('/courses',requireAuth,checkUser, courseController.getAllCourses);

dashboardRoutes.post('/edit-course/:id',requireAuth,checkUser, courseController.updateCoursePost);
dashboardRoutes.get('/course/:id',requireAuth,checkUser, courseController.getEditCourse);
dashboardRoutes.delete('/course/:id',requireAuth,checkUser, courseController.deleteCourse);
dashboardRoutes.get('/categories',requireAuth,checkUser, categoryController.getAllCategories);
dashboardRoutes.get('/settings',requireAuth,checkUser, categoryController.getSettingScreen);
dashboardRoutes.post('/create-category',requireAuth,checkUser, categoryController.createCategory);
dashboardRoutes.delete('/category/:id',requireAuth,checkUser, categoryController.deleteCategory);
dashboardRoutes.get('/subscriptions',requireAuth,checkUser, courseController.getAdminSubscription);
dashboardRoutes.get('/booking/:id/manage-payment',requireAuth,checkUser, courseController.getManagePayment);
dashboardRoutes.post('/booking/:id/confirm-payment',requireAuth,checkUser, courseController.confirmBookingPayment);
// مسار عرض صفحة الجدولة (GET)
dashboardRoutes.get('/booking/:id/schedule', courseController.getScheduleSessions); 

// مسار معالجة إرسال الجدولة (POST)
dashboardRoutes.post('/booking/:id/update-sessions', courseController.postUpdateSessions);
// مسار عرض صفحة إدارة الروابط (GET)
dashboardRoutes.get('/booking/:id/manage-sessions', courseController.getManageSessionsLinks); 

// مسار معالجة إرسال الروابط (POST)
dashboardRoutes.post('/booking/:id/update-links', courseController.postUpdateSessionsLinks);

dashboardRoutes.get('/admin/students', courseController.getManageStudents);
dashboardRoutes.get('/booking/:bookingId/session/:sessionId/complete', courseController.markSessionAsComplete);
dashboardRoutes.get('/admin/reports', courseController.adminReportPage);
dashboardRoutes.get('/admin/teachers', courseController.adminTeachersPage);
dashboardRoutes.post('/admin/teachers/update/:id', courseController.updateTeacher);
dashboardRoutes.post('/admin/teachers/add', courseController.addTeacher);
dashboardRoutes.post('/admin/check-teacher-conflict', courseController.checkConflict);
module.exports = dashboardRoutes;