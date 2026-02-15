const { Router } = require('express');
const academyController = require('../controllers/academyController');
const { requireAuth, requireSuperAdmin, checkUser } = require('../middleware/authMiddleware');

const router = Router();

// Super Admin Login
router.get('/superadmin/login', academyController.getSuperAdminLogin);

// Dashboard Home (Stats & Academy List)
router.get('/superadmin', requireAuth, checkUser, requireSuperAdmin, academyController.getSuperAdminDashboard);

// Academy Management
router.post('/superadmin/create-academy', requireAuth, checkUser, requireSuperAdmin, academyController.createAcademy);
router.post('/superadmin/toggle-status', requireAuth, checkUser, requireSuperAdmin, academyController.toggleAcademyStatus);
router.delete('/superadmin/academy/:id', requireAuth, checkUser, requireSuperAdmin, academyController.deleteAcademy);
router.get('/superadmin/academies', requireAuth, checkUser, requireSuperAdmin, academyController.getAllAcademies);

module.exports = router;
