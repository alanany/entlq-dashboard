const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'ChatRoom',
    tableName: 'chat_rooms',
    columns: {
        id: {
            primary: true,
            type: 'int',
            generated: true
        },
        type: {
            type: 'enum',
            enum: ['course', 'support', 'direct'],
            nullable: false
        },
        status: {
            type: 'enum',
            enum: ['active', 'closed'],
            default: 'active'
        },
        createdAt: {
            type: 'timestamp',
            createDate: true
        },
        updatedAt: {
            type: 'timestamp',
            updateDate: true
        }
    },
    relations: {
        participants: {
            target: 'User',
            type: 'many-to-many',
            joinTable: {
                name: 'chat_room_participants',
                joinColumn: { name: 'chatRoomId', referencedColumnName: 'id' },
                inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' }
            }
        },
        course: {
            target: 'Course',
            type: 'many-to-one',
            joinColumn: { name: 'courseId' },
            nullable: true,
            onDelete: 'SET NULL'
        },
        lastMessage: {
            target: 'Message',
            type: 'many-to-one',
            joinColumn: { name: 'lastMessageId' },
            nullable: true,
            onDelete: 'SET NULL'
        },
        academy: {
            target: 'Academy',
            type: 'many-to-one',
            joinColumn: { name: 'academyId' },
            nullable: false,
            onDelete: 'CASCADE'
        }
    }
});
