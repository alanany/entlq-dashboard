const { AppDataSource } = require('../../config/database');
const httpStatus = require('../../utility/http_status');

// Get all chat rooms for the student
exports.getChatRooms = async (req, res) => {
    try {
        const user = req.user || res.locals.user;
        const academyId = user.academyId || (user.academy && user.academy.id);
        const chatRoomRepository = AppDataSource.getRepository('ChatRoom');

        // find all rooms where user is participant
        const rooms = await chatRoomRepository.createQueryBuilder("room")
            .leftJoinAndSelect("room.participants", "participant")
            .leftJoinAndSelect("room.lastMessage", "lastMessage")
            .leftJoinAndSelect("lastMessage.sender", "sender")
            .leftJoinAndSelect("room.course", "course")
            .where("room.academyId = :academyId", { academyId })
            .andWhere("EXISTS (SELECT 1 FROM chat_rooms_participants_users rp WHERE rp.chatRoomsId = room.id AND rp.usersId = :userId)", { userId: user.id })
            .orderBy("room.updatedAt", "DESC")
            .getMany();

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
        const messageRepository = AppDataSource.getRepository('Message');
        const messages = await messageRepository.find({ 
            where: { chatRoom: { id: parseInt(roomId) } },
            relations: ['sender'],
            order: { createdAt: 'ASC' }
        });

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
        const userId = req.user.id || req.user._id;
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        
        const userRepository = AppDataSource.getRepository('User');
        const chatRoomRepository = AppDataSource.getRepository('ChatRoom');

        const admin = await userRepository.findOne({ where: { role: 'admin', academy: { id: academyId } } });
        
        if (!admin) {
            return res.status(404).json({
                status: 'fail',
                statusCode: httpStatus.FAILL,
                message: 'No admin found for support'
            });
        }

        let room = await chatRoomRepository.createQueryBuilder("room")
            .innerJoin("room.participants", "p1", "p1.id = :userId", { userId })
            .innerJoin("room.participants", "p2", "p2.id = :adminId", { adminId: admin.id })
            .leftJoinAndSelect("room.participants", "all_participants")
            .where("room.type = 'support'")
            .andWhere("room.academyId = :academyId", { academyId })
            .getOne();

        if (!room) {
            room = chatRoomRepository.create({
                type: 'support',
                academy: { id: academyId },
                participants: [{ id: userId }, { id: admin.id }]
            });
            await chatRoomRepository.save(room);
            
            room = await chatRoomRepository.findOne({ 
                where: { id: room.id }, 
                relations: ['participants'] 
            });
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
        const studentId = req.user.id || req.user._id;
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);

        const chatRoomRepository = AppDataSource.getRepository('ChatRoom');

        let room = await chatRoomRepository.createQueryBuilder("room")
            .innerJoin("room.participants", "p1", "p1.id = :studentId", { studentId })
            .innerJoin("room.participants", "p2", "p2.id = :teacherId", { teacherId })
            .leftJoinAndSelect("room.participants", "all_participants")
            .leftJoinAndSelect("room.course", "course")
            .where("room.type = 'course'")
            .andWhere("room.courseId = :courseId", { courseId })
            .andWhere("room.academyId = :academyId", { academyId })
            .getOne();

        if (!room) {
            room = chatRoomRepository.create({
                type: 'course',
                course: { id: parseInt(courseId) },
                academy: { id: parseInt(academyId) },
                participants: [{ id: studentId }, { id: parseInt(teacherId) }]
            });
            await chatRoomRepository.save(room);
            
            room = await chatRoomRepository.findOne({ 
                where: { id: room.id }, 
                relations: ['participants', 'course'] 
            });
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

// Create/Get Direct Room
exports.getOrCreateDirectRoom = async (req, res) => {
    try {
        const { targetUserId } = req.body;
        const currentUserId = req.user.id || req.user._id;
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);

        const chatRoomRepository = AppDataSource.getRepository('ChatRoom');

        let room = await chatRoomRepository.createQueryBuilder("room")
            .innerJoin("room.participants", "p1", "p1.id = :userId", { userId: currentUserId })
            .innerJoin("room.participants", "p2", "p2.id = :targetId", { targetId: targetUserId })
            .leftJoinAndSelect("room.participants", "all_participants")
            .where("room.type = 'direct'")
            .andWhere("room.academyId = :academyId", { academyId })
            .getOne();

        if (!room) {
            room = chatRoomRepository.create({
                type: 'direct',
                academy: { id: academyId },
                participants: [{ id: currentUserId }, { id: parseInt(targetUserId) }]
            });
            await chatRoomRepository.save(room);
            
            room = await chatRoomRepository.findOne({ 
                where: { id: room.id }, 
                relations: ['participants'] 
            });
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
