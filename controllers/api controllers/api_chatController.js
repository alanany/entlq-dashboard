const ChatRoom = require('../../models/chat_room_model');
const Message = require('../../models/message_model');
const User = require('../../models/user_model');
const httpStatus = require('../../utility/http_status');

// Get all chat rooms for the student
exports.getChatRooms = async (req, res) => {
    try {
        const rooms = await ChatRoom.find({ participants: req.user._id })
            .populate('participants', 'name email image role')
            .populate({
                path: 'lastMessage',
                populate: { path: 'sender', select: 'name' }
            })
            .populate('course', 'title coverImage')
            .sort({ updatedAt: -1 });

        res.status(200).json({
            status: 'success',
            statusCode: httpStatus.SUCCESS,
            data: rooms
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            statusCode: httpStatus.ERROR,
            message: 'Internal Server Error',
            error: err.message
        });
    }
};

// Get messages for a specific room
exports.getMessages = async (req, res) => {
    try {
        const { roomId } = req.params;
        const messages = await Message.find({ chatRoom: roomId })
            .populate('sender', 'name email image role')
            .sort({ createdAt: 1 });

        res.status(200).json({
            status: 'success',
            statusCode: httpStatus.SUCCESS,
            data: messages
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            statusCode: httpStatus.ERROR,
            message: 'Internal Server Error',
            error: err.message
        });
    }
};

// Create/Get Support Room
exports.getOrCreateSupportRoom = async (req, res) => {
    try {
        const userId = req.user._id;
        const admin = await User.findOne({ role: 'admin' });
        
        if (!admin) {
            return res.status(404).json({
                status: 'fail',
                statusCode: httpStatus.FAILL,
                message: 'No admin found for support'
            });
        }

        let room = await ChatRoom.findOne({
            type: 'support',
            participants: { $all: [userId, admin._id] }
        }).populate('participants', 'name email image role');

        if (!room) {
            room = await ChatRoom.create({
                type: 'support',
                participants: [userId, admin._id]
            });
            room = await room.populate('participants', 'name email image role').execPopulate();
        }

        res.status(200).json({
            status: 'success',
            statusCode: httpStatus.SUCCESS,
            data: room
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            statusCode: httpStatus.ERROR,
            message: 'Internal Server Error',
            error: err.message
        });
    }
};

// Create/Get Course Room
exports.getOrCreateCourseRoom = async (req, res) => {
    try {
        const { courseId, teacherId } = req.body;
        const studentId = req.user._id;

        let room = await ChatRoom.findOne({
            type: 'course',
            course: courseId,
            participants: { $all: [studentId, teacherId] }
        }).populate('participants', 'name email image role').populate('course', 'title');

        if (!room) {
            room = await ChatRoom.create({
                type: 'course',
                course: courseId,
                participants: [studentId, teacherId]
            });
            room = await room.populate('participants', 'name email image role').populate('course', 'title').execPopulate();
        }

        res.status(200).json({
            status: 'success',
            statusCode: httpStatus.SUCCESS,
            data: room
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            statusCode: httpStatus.ERROR,
            message: 'Internal Server Error',
            error: err.message
        });
    }
};
