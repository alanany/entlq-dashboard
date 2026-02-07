const { Router } = require('express');
const chatController = require('../controllers/chatController');
const { requireAuth,checkUser } = require('../middleware/authMiddleware');

const router = Router();

router.get('/chat', requireAuth,checkUser, (req, res) => {
    res.render('dashboard/chat', { 
        title: 'الدردشة',
        user: res.locals.user,
        currentLang: req.cookies.lang || 'ar',
        dir: (req.cookies.lang === 'ar' || !req.cookies.lang) ? 'rtl' : 'ltr'
    });
});

router.get('/api/chat/rooms', requireAuth,checkUser, chatController.getChatRooms);
router.get('/api/chat/rooms/:roomId/messages', requireAuth,checkUser, chatController.getMessages);
router.post('/api/chat/rooms/course', requireAuth,checkUser, chatController.getOrCreateCourseRoom);
router.post('/api/chat/rooms/support', requireAuth,checkUser, chatController.getOrCreateSupportRoom);

module.exports = router;
