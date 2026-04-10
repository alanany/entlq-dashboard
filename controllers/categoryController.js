// categoryController.js

const { AppDataSource } = require('../config/database');

const getSettingScreen = async (req, res) => {
    res.render('dashboard/settings', { 
            title: 'الإعدادات',
            user: req.user
        });
};

const getSystemSettings = async (req, res) => {
    try {
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        const settingsRepository = AppDataSource.getRepository('SystemSettings');
        
        let settings = await settingsRepository.findOne({ where: { academy: { id: academyId } } });
        if (!settings) {
            settings = settingsRepository.create({ 
                academy: { id: academyId },
                academyName: 'أكاديمية جديدة' 
            });
            await settingsRepository.save(settings);
        }
        res.render('dashboard/settings-system', { title: 'إعدادات النظام', settings, user: req.user });
    } catch (err) {
        console.error(err);
        res.status(500).send('خطأ في جلب بيانات الإعدادات');
    }
};

const updateSystemSettings = async (req, res) => {
    try {
        const updateData = req.body;
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        const settingsRepository = AppDataSource.getRepository('SystemSettings');
        
        let settings = await settingsRepository.findOne({ where: { academy: { id: academyId } } });
        if (!settings) {
            settings = settingsRepository.create({ academy: { id: academyId }, ...updateData });
        } else {
            // merge updates
            settings = settingsRepository.merge(settings, updateData);
        }
        await settingsRepository.save(settings);
        
        res.status(200).json({ message: 'تم التحديث بنجاح', settings });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'فشل التحديث' });
    }
};

// 1. جلب جميع الأقسام (GET)
const getAllCategories = async (req, res) => {
    try {
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        console.log('Fetching categories for academyId:', academyId);
        
        const categoryRepository = AppDataSource.getRepository('Category');
        const courseRepository = AppDataSource.getRepository('Course');
        
        const categories = await categoryRepository.find({ where: { academy: { id: academyId } } });
        
        // جلب عدد الدورات لكل قسم
        const categoriesWithCount = await Promise.all(categories.map(async (cat) => {
            const count = await courseRepository.count({ where: { category: { id: cat.id }, academy: { id: academyId } } });
            return { ...cat, courseCount: count };
        }));
        
        res.render('dashboard/categories', { 
            title: 'إدارة أقسام الدورات',
            categories: categoriesWithCount,
            user: req.user
        });
    } catch (err) {
        console.error('Error in getAllCategories:', err);
        res.status(500).render('error', { message: 'فشل في تحميل الأقسام.' });
    }
};

// 2. إضافة قسم جديد (POST)
const createCategory = async (req, res) => {
    const { name } = req.body;
    
    if (!name) {
        return res.status(400).json({ message: 'اسم القسم مطلوب' });
    }

    try {
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        console.log('Creating category for academyId:', academyId, 'name:', name);

        const categoryRepository = AppDataSource.getRepository('Category');
        
        let slug = name.replace(/\s+/g, '-');
        
        const category = categoryRepository.create({ 
            name, 
            slug,
            academy: { id: academyId } 
        });
        
        await categoryRepository.save(category);
        
        res.status(201).json({ 
            message: 'تم إنشاء القسم بنجاح.', 
            category: category
        });
    } catch (err) {
        console.error('Error in createCategory:', err);
        let errorMessage = 'فشل في إنشاء القسم.';
        if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) { 
            errorMessage = 'هذا القسم موجود بالفعل لهذه الأكاديمية.';
        }
        res.status(400).json({ message: errorMessage });
    }
};

// 3. حذف قسم (DELETE)
const deleteCategory = async (req, res) => {
    const categoryId = req.params.id;
    
    try {
        const academyId = req.user.academyId || (req.user.academy && req.user.academy.id);
        
        const categoryRepository = AppDataSource.getRepository('Category');
        const courseRepository = AppDataSource.getRepository('Course');
        
        // التحقق من وجود كورسات مرتبطة
        const hasCourses = await courseRepository.exists({ where: { category: { id: categoryId }, academy: { id: academyId } } });
        if (hasCourses) {
            return res.status(400).json({ message: 'لا يمكن حذف القسم لوجود دورات مرتبطة به.' });
        }

        const category = await categoryRepository.findOne({ where: { id: categoryId, academy: { id: academyId } } });
        if (!category) {
            return res.status(404).json({ message: 'القسم غير موجود.' });
        }
        
        await categoryRepository.remove(category);
        
        res.status(200).json({ message: 'تم حذف القسم بنجاح.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'فشل في حذف القسم.' });
    }
};

module.exports = {
    getAllCategories,
    createCategory,
    deleteCategory,
    getSettingScreen,
    getSystemSettings,
    updateSystemSettings
};