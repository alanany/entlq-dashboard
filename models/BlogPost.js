const mongoose = require('mongoose');

const blogPostSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    image: { type: String },
    author: { type: String, default: 'Admin' },
    summary: { type: String },
    isPublished: { type: Boolean, default: true },
    academyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Academy', required: true }
}, { timestamps: true });

const BlogPost = mongoose.model('BlogPost', blogPostSchema);

module.exports = BlogPost;
