const WebsiteSection = require('../models/WebsiteSection');
const BlogPost = require('../models/BlogPost');

// GET - Website Sections List
const getWebsiteSections = async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const sections = await WebsiteSection.find({ academyId });
        res.render('dashboard/website-sections', { 
            title: 'إدارة أقسام الموقع', 
            sections, 
            currentPage: 'website-sections' 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// POST - Update or Create Website Section
const updateWebsiteSection = async (req, res) => {
    try {
        const { key, title, subtitle, content, buttonText, buttonLink } = req.body;
        const image = req.file ? `/uploads/${req.file.filename}` : req.body.existingImage;
        const academyId = req.user.academyId;

        await WebsiteSection.findOneAndUpdate(
            { key, academyId },
            { title, subtitle, content, buttonText, buttonLink, image },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'تم تحديث القسم بنجاح' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'حدث خطأ أثناء التحديث' });
    }
};

// GET - Blog Posts List
const getBlogPosts = async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const posts = await BlogPost.find({ academyId }).sort({ createdAt: -1 });
        res.render('dashboard/website-blog', { 
            title: 'إدارة المدونة', 
            posts, 
            currentPage: 'website-blog' 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};

// POST - Add Blog Post
const addBlogPost = async (req, res) => {
    try {
        const { title, content, summary } = req.body;
        const image = req.file ? `/uploads/${req.file.filename}` : null;
        const academyId = req.user.academyId;

        await BlogPost.create({ title, content, summary, image, academyId });
        res.status(201).json({ message: 'تم إضافة المقال بنجاح' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'حدث خطأ أثناء الإضافة' });
    }
};

// DELETE - Delete Blog Post
const deleteBlogPost = async (req, res) => {
    try {
        const academyId = req.user.academyId;
        await BlogPost.findOneAndDelete({ _id: req.params.id, academyId });
        res.status(200).json({ message: 'تم حذف المقال بنجاح' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'حدث خطأ أثناء الحذف' });
    }
};

module.exports = {
    getWebsiteSections,
    updateWebsiteSection,
    getBlogPosts,
    addBlogPost,
    deleteBlogPost
};
