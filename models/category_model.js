const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'Category',
    tableName: 'categories',
    columns: {
        id: {
            primary: true,
            type: 'int',
            generated: true
        },
        name: {
            type: 'varchar',
            nullable: false
        },
        slug: {
            type: 'varchar',
            nullable: true
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
            nullable: false,
            onDelete: 'CASCADE'
        }
    },
    indices: [
        {
            name: 'IDX_CATEGORY_NAME_ACADEMY',
            unique: true,
            columns: ['name', 'academyId']
        },
        {
            name: 'IDX_CATEGORY_SLUG_ACADEMY',
            unique: true,
            columns: ['slug', 'academyId']
        }
    ]
});