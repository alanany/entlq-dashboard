const ChatRoom = require('../models/chat_room_model');
const Message = require('../models/message_model');
const User = require('../models/user_model');
const Course = require('../models/course_model');

// جلب جميع غرف الدردشة للمستخدم الحالي (طالب، معلم، أو مسؤول)
exports.getChatRooms = async (req, res) => {
    try {
        let rooms;
        const user = req.user || res.locals.user;
        if (user.role === 'admin') {
            rooms = await ChatRoom.find().populate('participants lastMessage course');
        } else {
            rooms = await ChatRoom.find({ participants: user._id }).populate('participants lastMessage course');
        }
        res.json(rooms);
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ أثناء جلب غرف الدردشة', error: err.message });
    }
};

// جلب الرسائل لغرفة محددة
exports.getMessages = async (req, res) => {
    try {
        const { roomId } = req.params;
        const messages = await Message.find({ chatRoom: roomId }).populate('sender');
        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ أثناء جلب الرسائل', error: err.message });
    }
};

// إنشاء أو جلب غرفة دردشة خاصة بدورة تدريبية
exports.getOrCreateCourseRoom = async (req, res) => {
    const { courseId, teacherId } = req.body;
    const studentId = (req.user || res.locals.user)._id;
    try {
        let room = await ChatRoom.findOne({
            type: 'course',
            course: courseId,
            participants: { $all: [studentId, teacherId] }
        });

        if (!room) {
            room = await ChatRoom.create({
                type: 'course',
                course: courseId,
                participants: [studentId, teacherId]
            });
        }
        res.json(room);
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ أثناء إنشاء غرفة دردشة الدورة', error: err.message });
    }
};

// إنشاء أو جلب غرفة دردشة للدعم الفني
exports.getOrCreateSupportRoom = async (req, res) => {
    const userId = (req.user || res.locals.user)._id;
    try {
        const admin = await User.findOne({ role: 'admin' });
        if (!admin) return res.status(404).json({ message: 'لا يوجد مسؤول متاح حالياً' });

        let room = await ChatRoom.findOne({
            type: 'support',
            participants: { $all: [userId, admin._id] }
        });

        if (!room) {
            room = await ChatRoom.create({
                type: 'support',
                participants: [userId, admin._id]
            });
        }
        res.json(room);
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ أثناء إنشاء غرفة دردشة الدعم', error: err.message });
    }
};
