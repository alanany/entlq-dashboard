const { AppDataSource } = require('../config/database');

// جلب جميع غرف الدردشة للمستخدم الحالي (طالب، معلم، أو مسؤول)
exports.getChatRooms = async (req, res) => {
    try {
        let rooms;
        const user = req.user || res.locals.user;
        const academyId = user.academyId || (user.academy && user.academy.id);
        const chatRoomRepository = AppDataSource.getRepository('ChatRoom');

        if (user.role === 'admin') {
            rooms = await chatRoomRepository.find({ 
                where: { academy: { id: academyId } },
                relations: ['participants', 'lastMessage', 'course'] 
            });
        } else {
            rooms = await chatRoomRepository.createQueryBuilder("room")
                .leftJoinAndSelect("room.participants", "participant")
                .leftJoinAndSelect("room.lastMessage", "lastMessage")
                .leftJoinAndSelect("room.course", "course")
                .where("room.academyId = :academyId", { academyId })
                // filter by user being a participant
                .andWhere("EXISTS (SELECT 1 FROM chat_rooms_participants_users rp WHERE rp.chatRoomsId = room.id AND rp.usersId = :userId)", { userId: user.id })
                .getMany();
                // Note: The specific junction table name chat_rooms_participants_users may vary based on exact schema generation.
                // A safer way if ManyToMany is fully defined:
                /*rooms = await chatRoomRepository.find({
                    where: { academy: { id: academyId }, participants: { id: user.id } },
                    relations: ['participants', 'lastMessage', 'course']
                }); // TypeORM 0.3.0+ supports relation filtering in where*/
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
        const messageRepository = AppDataSource.getRepository('Message');
        const messages = await messageRepository.find({ 
            where: { chatRoom: { id: parseInt(roomId) } },
            relations: ['sender']
        });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ أثناء جلب الرسائل', error: err.message });
    }
};

// إنشاء أو جلب غرفة دردشة خاصة بدورة تدريبية
exports.getOrCreateCourseRoom = async (req, res) => {
    const { courseId, teacherId } = req.body;
    const user = req.user || res.locals.user;
    const studentId = user.id;
    const academyId = user.academyId || (user.academy && user.academy.id);
    
    try {
        const chatRoomRepository = AppDataSource.getRepository('ChatRoom');

        let room = await chatRoomRepository.createQueryBuilder("room")
            .innerJoin("room.participants", "p1", "p1.id = :studentId", { studentId })
            .innerJoin("room.participants", "p2", "p2.id = :teacherId", { teacherId })
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
        }
        res.json(room);
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ أثناء إنشاء غرفة دردشة الدورة', error: err.message });
    }
};

// إنشاء أو جلب غرفة دردشة للدعم الفني
exports.getOrCreateSupportRoom = async (req, res) => {
    const user = req.user || res.locals.user;
    const academyId = user.academyId || (user.academy && user.academy.id);
    
    try {
        const chatRoomRepository = AppDataSource.getRepository('ChatRoom');
        const userRepository = AppDataSource.getRepository('User');
        
        const admin = await userRepository.findOne({ where: { role: 'admin', academy: { id: academyId } } });
        if (!admin) return res.status(404).json({ message: 'لا يوجد مسؤول متاح حالياً لهذه الأكاديمية' });

        let room = await chatRoomRepository.createQueryBuilder("room")
            .innerJoin("room.participants", "p1", "p1.id = :userId", { userId: user.id })
            .innerJoin("room.participants", "p2", "p2.id = :adminId", { adminId: admin.id })
            .where("room.type = 'support'")
            .andWhere("room.academyId = :academyId", { academyId })
            .getOne();

        if (!room) {
            room = chatRoomRepository.create({
                type: 'support',
                academy: { id: academyId },
                participants: [{ id: user.id }, { id: admin.id }]
            });
            await chatRoomRepository.save(room);
        }
        res.json(room);
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ أثناء إنشاء غرفة دردشة الدعم', error: err.message });
    }
};

// إنشاء أو جلب غرفة دردشة مباشرة بين مستخدمين
exports.getOrCreateDirectRoom = async (req, res) => {
    const user = req.user || res.locals.user;
    const { targetUserId } = req.body;
    const academyId = user.academyId || (user.academy && user.academy.id);

    try {
        const chatRoomRepository = AppDataSource.getRepository('ChatRoom');

        let room = await chatRoomRepository.createQueryBuilder("room")
            .innerJoin("room.participants", "p1", "p1.id = :userId", { userId: user.id })
            .innerJoin("room.participants", "p2", "p2.id = :targetUserId", { targetUserId })
            .where("room.type = 'direct'")
            .andWhere("room.academyId = :academyId", { academyId })
            .getOne();

        if (!room) {
            room = chatRoomRepository.create({
                type: 'direct',
                academy: { id: academyId },
                participants: [{ id: user.id }, { id: parseInt(targetUserId) }]
            });
            await chatRoomRepository.save(room);
        }
        res.json(room);
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ أثناء إنشاء غرفة الدردشة المباشرة', error: err.message });
    }
};

module.exports = {
    getChatRooms: exports.getChatRooms,
    getMessages: exports.getMessages,
    getOrCreateCourseRoom: exports.getOrCreateCourseRoom,
    getOrCreateSupportRoom: exports.getOrCreateSupportRoom,
    getOrCreateDirectRoom: exports.getOrCreateDirectRoom
};
