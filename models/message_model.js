const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'Message',
    tableName: 'messages',
    columns: {
        id: {
            primary: true,
            type: 'int',
            generated: true
        },
        content: {
            type: 'text',
            nullable: false
        },
        type: {
            type: 'enum',
            enum: ['text', 'image', 'file'],
            default: 'text'
        },
        readBy: {
            type: 'json',
            nullable: true // array of user ids
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
        chatRoom: {
            target: 'ChatRoom',
            type: 'many-to-one',
            joinColumn: { name: 'chatRoomId' },
            nullable: false,
            onDelete: 'CASCADE'
        },
        sender: {
            target: 'User',
            type: 'many-to-one',
            joinColumn: { name: 'senderId' },
            nullable: false,
            onDelete: 'CASCADE'
        }
    }
});
