const { AppDataSource } = require('../config/database');

// GET - Website Sections List
const getWebsiteSections = async (req, res) => {
    try {
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        const websiteSectionRepository = AppDataSource.getRepository('WebsiteSection');
        
        const sections = await websiteSectionRepository.find({ where: { academy: { id: academyId } } });
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
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        
        const websiteSectionRepository = AppDataSource.getRepository('WebsiteSection');

        let section = await websiteSectionRepository.findOne({ where: { key, academy: { id: academyId } } });
        
        if (section) {
            section = websiteSectionRepository.merge(section, { title, subtitle, content, buttonText, buttonLink, image });
        } else {
            section = websiteSectionRepository.create({
                key, title, subtitle, content, buttonText, buttonLink, image, academy: { id: academyId }
            });
        }
        
        await websiteSectionRepository.save(section);

        res.status(200).json({ message: 'تم تحديث القسم بنجاح' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'حدث خطأ أثناء التحديث' });
    }
};

// GET - Blog Posts List
const getBlogPosts = async (req, res) => {
    try {
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        const blogPostRepository = AppDataSource.getRepository('BlogPost');
        
        const posts = await blogPostRepository.find({ 
            where: { academy: { id: academyId } },
            order: { createdAt: 'DESC' }
        });
        
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
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);

        const blogPostRepository = AppDataSource.getRepository('BlogPost');
        const post = blogPostRepository.create({ title, content, summary, image, academy: { id: academyId } });
        await blogPostRepository.save(post);
        
        res.status(201).json({ message: 'تم إضافة المقال بنجاح' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'حدث خطأ أثناء الإضافة' });
    }
};

// DELETE - Delete Blog Post
const deleteBlogPost = async (req, res) => {
    try {
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        const blogPostRepository = AppDataSource.getRepository('BlogPost');
        
        const post = await blogPostRepository.findOne({ where: { id: req.params.id, academy: { id: academyId } } });
        if (post) {
            await blogPostRepository.remove(post);
        }
        
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
