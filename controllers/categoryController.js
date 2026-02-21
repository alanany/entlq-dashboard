// categoryController.js

const Category = require('../models/category_model.js');
const SystemSettings = require('../models/SystemSettings');
const getSettingScreen = async (req, res) => {
    res.render('dashboard/settings', { 
            title: 'الإعدادات',
            user: req.user
        });
};

const getSystemSettings = async (req, res) => {
    try {
        const academyId = req.user.academyId;
        let settings = await SystemSettings.findOne({ academyId });
        if (!settings) {
            settings = await SystemSettings.create({ 
                academyId,
                academyName: 'أكاديمية جديدة' 
            });
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
        const academyId = req.user.academyId;
        let settings = await SystemSettings.findOneAndUpdate(
            { academyId }, 
            updateData, 
            { new: true, upsert: true }
        );
        res.status(200).json({ message: 'تم التحديث بنجاح', settings });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'فشل التحديث' });
    }
};
// 1. جلب جميع الأقسام (GET)
const getAllCategories = async (req, res) => {
    try {
        const academyId = req.user.academyId?._id || req.user.academyId;
        console.log('Fetching categories for academyId:', academyId);
        
        const categories = await Category.find({ academyId }).lean();
        
        // جلب عدد الدورات لكل قسم
        const Course = require('../models/course_model');
        const categoriesWithCount = await Promise.all(categories.map(async (cat) => {
            const count = await Course.countDocuments({ category: cat._id, academyId });
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
        const academyId = req.user.academyId?._id || req.user.academyId;
        console.log('Creating category for academyId:', academyId, 'name:', name);

        const category = await Category.create({ 
            name, 
            academyId 
        });
        res.status(201).json({ 
            message: 'تم إنشاء القسم بنجاح.', 
            category: category
        });
    } catch (err) {
        console.error('Error in createCategory:', err);
        let errorMessage = 'فشل في إنشاء القسم.';
        if (err.code === 11000) { 
            errorMessage = 'هذا القسم موجود بالفعل لهذه الأكاديمية.';
        } else if (err.name === 'ValidationError') {
            errorMessage = Object.values(err.errors).map(val => val.message).join(', ');
        }
        res.status(400).json({ message: errorMessage });
    }
};

// 3. حذف قسم (DELETE)
const deleteCategory = async (req, res) => {
    const categoryId = req.params.id;
    
    try {
        const academyId = req.user.academyId._id || req.user.academyId;
        
        // التحقق من وجود كورسات مرتبطة
        const Course = require('../models/course_model');
        const hasCourses = await Course.exists({ category: categoryId, academyId });
        if (hasCourses) {
            return res.status(400).json({ message: 'لا يمكن حذف القسم لوجود دورات مرتبطة به.' });
        }

        const result = await Category.findOneAndDelete({ 
            _id: categoryId, 
            academyId 
        });

        if (!result) {
            return res.status(404).json({ message: 'القسم غير موجود.' });
        }
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