const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'Academy',
    tableName: 'academies',
    columns: {
        id: {
            primary: true,
            type: 'int',
            generated: true
        },
        name: {
            type: 'varchar',
            unique: true,
            nullable: false
        },
        subdomain: {
            type: 'varchar',
            unique: true,
            nullable: true
        },
        logo: {
            type: 'varchar',
            nullable: true
        },
        settings: {
            type: 'json',
            nullable: true // Will store { primaryColor: '#FE5D37', currency: 'USD' }
        },
        status: {
            type: 'enum',
            enum: ['active', 'suspended'],
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
    }
});
