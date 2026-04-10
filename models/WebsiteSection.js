const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'WebsiteSection',
    tableName: 'website_sections',
    columns: {
        id: {
            primary: true,
            type: 'int',
            generated: true
        },
        key: {
            type: 'varchar',
            nullable: false
        },
        title: {
            type: 'varchar',
            nullable: false
        },
        subtitle: {
            type: 'varchar',
            nullable: true
        },
        content: {
            type: 'text',
            nullable: true
        },
        image: {
            type: 'varchar',
            nullable: true
        },
        buttonText: {
            type: 'varchar',
            nullable: true
        },
        buttonLink: {
            type: 'varchar',
            nullable: true
        },
        isActive: {
            type: 'boolean',
            default: true
        },
        createdAt: {
            type: 'timestamp',
            createDate: true
        },
        updatedAt: {
            type: 'timestamp',
            updateDate: true
        },
        academyId: {
            type: 'int',
            nullable: true
        }
    },
    relations: {
        academy: {
            target: 'Academy',
            type: 'many-to-one',
            joinColumn: { name: 'academyId' },
            nullable: true,
            onDelete: 'CASCADE'
        }
    },
    indices: [
        {
            name: 'IDX_WEBSITESECTION_KEY_ACADEMY',
            unique: true,
            columns: ['key', 'academyId']
        }
    ]
});
