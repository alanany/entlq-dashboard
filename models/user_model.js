// models/user_model.js
const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'User', // Will generate 'user' table
    tableName: 'users',
    columns: {
        id: {
            primary: true,
            type: 'int',
            generated: true,
        },
        email: {
            type: 'varchar',
            unique: true,
            nullable: false, // required
        },
        // We'll store array of devices as a JSON string for simplicity, or json data type
        devices: {
            type: 'json',
            nullable: true,
        },
        country_code: {
            type: 'varchar',
            nullable: true,
        },
        gender: {
            type: 'varchar',
            nullable: true,
        },
        phone_number: {
            type: 'varchar',
            nullable: true,
        },
        name: {
            type: 'varchar',
            nullable: true,
        },
        zoom_link: {
            type: 'varchar',
            nullable: true,
        },
        isActive: {
            type: 'boolean',
            default: true,
        },
        password: {
            type: 'varchar',
            nullable: false,
        },
        role: {
            type: 'enum',
            enum: ['admin', 'student', 'teacher', 'supervisor', 'superadmin'],
            default: 'student',
        },
        timezone: {
            type: 'varchar',
            default: 'UTC',
        },
        status: {
            type: 'enum',
            enum: ['active', 'archived'],
            default: 'active',
        },
        hour_rate: {
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
        },
        hourly_rates: {
            type: 'json',
            nullable: true,
        },
        image: {
            type: 'varchar',
            nullable: true,
        },
        notes: {
            type: 'text',
            nullable: true,
        },
        token: {
            type: 'varchar',
            nullable: true,
        },
        createdAt: {
            type: 'timestamp',
            createDate: true,
        },
        updatedAt: {
            type: 'timestamp',
            updateDate: true,
        }
    },
    relations: {
        academy: {
            target: 'Academy', 
            type: 'many-to-one',
            joinColumn: { name: 'academyId' },
            nullable: true,
            onDelete: 'SET NULL'
        },
        supervisor: {
            target: 'User',
            type: 'many-to-one',
            joinColumn: { name: 'supervisorId' },
            nullable: true,
            onDelete: 'SET NULL'
        }
    }
});