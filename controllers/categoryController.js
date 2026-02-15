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
        const categories = await Category.find({ academyId: req.user.academyId }).lean();
        
        // 💡 لتبسيط المثال، لم نقم بجلب courseCount. ستحتاج لربطها بنموذج Course لحساب العدد الفعلي.
        
        res.render('dashboard/categories', { 
            title: 'إدارة أقسام الدورات',
            categories: categories 
        });
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'فشل في تحميل الأقسام.' });
    }
};

// 2. إضافة قسم جديد (POST)
const createCategory = async (req, res) => {
    const { name } = req.body;
    
    try {
        const category = await Category.create({ 
            name, 
            academyId: req.user.academyId 
        });
        res.status(201).json({ 
            message: 'تم إنشاء القسم بنجاح.', 
            category: category
        });
    } catch (err) {
        let errorMessage = 'فشل في إنشاء القسم.';
        if (err.code === 11000) { // خطأ تكرار (unique constraint)
            errorMessage = 'هذا القسم موجود بالفعل.';
        } else if (err.name === 'ValidationError') {
            errorMessage = Object.values(err.errors).map(val => val.message).join(', ');
        }
        res.status(400).json({ message: errorMessage });
    }
};

// 3. حذف قسم (DELETE)
const deleteCategory = async (req, res) => {
    const categoryId = req.params.id;
    
    // 💡 يمكن إضافة تحقق هنا: هل يوجد كورسات مرتبطة بهذا القسم؟
    
    try {
        const result = await Category.findOneAndDelete({ 
            _id: categoryId, 
            academyId: req.user.academyId 
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