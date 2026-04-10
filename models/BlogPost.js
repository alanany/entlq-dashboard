const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'BlogPost',
    tableName: 'blog_posts',
    columns: {
        id: {
            primary: true,
            type: 'int',
            generated: true
        },
        title: {
            type: 'varchar',
            nullable: false
        },
        content: {
            type: 'text',
            nullable: false
        },
        image: {
            type: 'varchar',
            nullable: true
        },
        author: {
            type: 'varchar',
            default: 'Admin'
        },
        summary: {
            type: 'varchar',
            nullable: true
        },
        isPublished: {
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
        }
    },
    relations: {
        academy: {
            target: 'Academy',
            type: 'many-to-one',
            joinColumn: { name: 'academyId' },
            nullable: false,
            onDelete: 'CASCADE'
        }
    }
});
