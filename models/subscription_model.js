const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'Subscription',
    tableName: 'subscriptions',
    columns: {
        id: {
            primary: true,
            type: 'int',
            generated: true
        },
        startDate: {
            type: 'timestamp',
            nullable: true
        },
        sessions: {
            type: 'json',
            nullable: true // Array of session objects (durationMinutes, date, time, link, etc.)
        },
        selectedPriceOption: {
            type: 'varchar',
            nullable: false
        },
        numberOfSessionsPerMonth: {
            type: 'int',
            nullable: false
        },
        totalAmount: {
            type: 'decimal',
            precision: 10,
            scale: 2,
            nullable: false
        },
        teacherHourlyRate: {
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0
        },
        status: {
            type: 'enum',
            enum: ['pending', 'confirmed', 'cancelled', 'completed'],
            default: 'pending'
        },
        paymentDetails: {
            type: 'json',
            nullable: true // Stores { transactionId: String, method: String }
        },
        confirmedBy: {
            type: 'varchar', // Admin or supervisor name
            nullable: true
        },
        paymentScreenshot: {
            type: 'varchar',
            nullable: true
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
        student: {
            target: 'User',
            type: 'many-to-one',
            joinColumn: { name: 'studentId' },
            nullable: false,
            onDelete: 'CASCADE'
        },
        course: {
            target: 'Course',
            type: 'many-to-one',
            joinColumn: { name: 'courseId' },
            nullable: false,
            onDelete: 'CASCADE'
        },
        teacher: {
            target: 'User',
            type: 'many-to-one',
            joinColumn: { name: 'teacherId' },
            nullable: true,
            onDelete: 'SET NULL'
        },
        academy: {
            target: 'Academy',
            type: 'many-to-one',
            joinColumn: { name: 'academyId' },
            nullable: true,
            onDelete: 'CASCADE'
        }
    }
});
