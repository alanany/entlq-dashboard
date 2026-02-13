const { Router } = require('express');
const supervisorController = require('../controllers/supervisorController');
const { checkUser, requireAuth } = require('../middleware/authMiddleware');

const supervisorRoutes = Router();

// Middleware to ensure user is a supervisor
const requireSupervisor = (req, res, next) => {
    if (req.user && req.user.role === 'supervisor') {
        next();
    } else {
        res.status(403).send('غير مسموح لك بالدخول، هذه المنطقة للمشرفين فقط');
    }
};

// Dashboard
supervisorRoutes.get('/supervisor', requireAuth, checkUser, requireSupervisor, supervisorController.supervisorDashboard);

// Teachers
supervisorRoutes.get('/supervisor/teachers', requireAuth, checkUser, requireSupervisor, supervisorController.supervisorTeachers);
supervisorRoutes.get('/supervisor/teacher/:id', requireAuth, checkUser, requireSupervisor, supervisorController.getTeacherDetails);
supervisorRoutes.get('/supervisor/teacher/schedule/:id', requireAuth, checkUser, requireSupervisor, supervisorController.getTeacherSchedule);

// Students
supervisorRoutes.get('/supervisor/students', requireAuth, checkUser, requireSupervisor, supervisorController.supervisorStudents);
supervisorRoutes.get('/supervisor/student/profile/:id', requireAuth, checkUser, requireSupervisor, supervisorController.getStudentProfile);

// Sessions
supervisorRoutes.get('/supervisor/sessions', requireAuth, checkUser, requireSupervisor, supervisorController.supervisorSessions);

// Messages
supervisorRoutes.get('/supervisor/messages', requireAuth, checkUser, requireSupervisor, supervisorController.supervisorMessages);

// Settings
supervisorRoutes.get('/supervisor/settings', requireAuth, checkUser, requireSupervisor, supervisorController.supervisorSettings);
supervisorRoutes.post('/supervisor/settings/update-password', requireAuth, checkUser, requireSupervisor, supervisorController.updateSupervisorPassword);
supervisorRoutes.post('/supervisor/settings/update-profile', requireAuth, checkUser, requireSupervisor, supervisorController.updateSupervisorProfile);

module.exports = supervisorRoutes;
