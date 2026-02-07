const ChatRoom = require('../models/chat_room_model');
const Message = require('../models/message_model');

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);

        socket.on('joinRoom', ({ roomId }) => {
            socket.join(roomId);
            console.log(`User ${socket.id} joined room ${roomId}`);
        });

        socket.on('sendMessage', async (data) => {
            const { roomId, senderId, content, type } = data;
            try {
                const message = await Message.create({
                    chatRoom: roomId,
                    sender: senderId,
                    content,
                    type: type || 'text'
                });

                const populatedMessage = await Message.findById(message._id).populate('sender');

                await ChatRoom.findByIdAndUpdate(roomId, { lastMessage: message._id });

                io.to(roomId).emit('message', populatedMessage);
            } catch (err) {
                console.error('Error sending message:', err);
            }
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected');
        });
    });
};
