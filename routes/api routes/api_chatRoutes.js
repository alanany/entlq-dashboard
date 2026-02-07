const { Router } = require('express');
const ApiChatController = require('../../controllers/api controllers/api_chatController');
const authenticate = require('../../validation/authenticate_token');
const multer = require('multer');
const upload = multer();

const router = Router();

// Chat APIs for Flutter Mobile App
router.get('/api/v1/chat/rooms', authenticate, ApiChatController.getChatRooms);
router.get('/api/v1/chat/rooms/:roomId/messages', authenticate, ApiChatController.getMessages);
router.post('/api/v1/chat/rooms/support', authenticate, upload.none(), ApiChatController.getOrCreateSupportRoom);
router.post('/api/v1/chat/rooms/course', authenticate, upload.none(), ApiChatController.getOrCreateCourseRoom);

module.exports = router;
