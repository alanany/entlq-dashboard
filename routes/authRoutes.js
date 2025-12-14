const { Router } = require('express');
const authController = require('../controllers/authController');

const router = Router();

router.get('/admin_register', authController.signup_get);
router.post('/admin_register', authController.signup_post);
router.get('/login', authController.login_get);
router.post('/login', authController.login_post);
router.get('/logout', authController.logout_get);
router.get('/student/logout', authController.student_logout_get);

module.exports = router;