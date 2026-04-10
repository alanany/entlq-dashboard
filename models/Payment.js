const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'Payment',
    tableName: 'payments',
    columns: {
        id: {
            primary: true,
            type: 'int',
            generated: true
        },
        type: {
            type: 'enum',
            enum: ['income', 'expense'],
            nullable: false
        },
        category: {
            type: 'enum',
            enum: ['subscription', 'salary', 'other'],
            default: 'other'
        },
        amount: {
            type: 'decimal',
            precision: 10,
            scale: 2,
            nullable: false
        },
        status: {
            type: 'varchar',
            default: 'completed'
        },
        date: {
            type: 'timestamp',
            default: () => 'CURRENT_TIMESTAMP'
        },
        description: {
            type: 'varchar',
            nullable: true
        },
        month: {
            type: 'varchar',
            nullable: true
        },
        paymentDate: {
            type: 'timestamp',
            default: () => 'CURRENT_TIMESTAMP'
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
        fromUser: {
            target: 'User',
            type: 'many-to-one',
            joinColumn: { name: 'fromUserId' },
            nullable: true,
            onDelete: 'SET NULL'
        },
        toUser: {
            target: 'User',
            type: 'many-to-one',
            joinColumn: { name: 'toUserId' },
            nullable: true,
            onDelete: 'SET NULL'
        },
        subscription: {
            target: 'Subscription',
            type: 'many-to-one',
            joinColumn: { name: 'subscriptionId' },
            nullable: true,
            onDelete: 'SET NULL'
        },
        teacher: {
            target: 'User',
            type: 'many-to-one',
            joinColumn: { name: 'teacherId' },
            nullable: true,
            onDelete: 'SET NULL'
        },
        admin: {
            target: 'User',
            type: 'many-to-one',
            joinColumn: { name: 'adminId' },
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