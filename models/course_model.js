const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'Course',
    tableName: 'courses',
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
        description: {
            type: 'text',
            nullable: false
        },
        level: {
            type: 'enum',
            enum: ['beginner', 'intermediate', 'advanced'],
            nullable: true
        },
        isPublished: {
            type: 'boolean',
            default: true
        },
        pricingOptions: {
            type: 'json',
            nullable: false
        },
        coverImage: {
            type: 'varchar',
            nullable: true
        },
        curriculum: {
            type: 'json',
            nullable: true // Stores array of SectionSchema and LessonSchema
        }
    },
    relations: {
        category: {
            target: 'Category',
            type: 'many-to-one',
            joinColumn: { name: 'categoryId' },
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