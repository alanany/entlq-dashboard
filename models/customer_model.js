const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'Customer',
    tableName: 'customers',
    columns: {
        id: {
            primary: true,
            type: 'int',
            generated: true
        },
        firstName: {
            type: 'varchar',
            nullable: true
        },
        lastName: {
            type: 'varchar',
            nullable: true
        },
        email: {
            type: 'varchar',
            nullable: true
        },
        phoneNumber: {
            type: 'varchar',
            nullable: true
        },
        age: {
            type: 'varchar',
            nullable: true
        },
        countery: { // Spelled consistently with original
            type: 'varchar',
            nullable: true
        },
        gender: {
            type: 'varchar',
            nullable: true
        },
        userId: {
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
    }
});