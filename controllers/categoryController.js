// categoryController.js

const Category = require('../models/category_model.js');
const getSettingScreen = async (req, res) => {
    res.render('dashboard/settings', { 
            title: '  الاعدادات',
           
        });
};
// 1. جلب جميع الأقسام (GET)
const getAllCategories = async (req, res) => {
    try {
        const categories = await Category.find({}).lean();
        
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
        const category = await Category.create({ name });
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
        const result = await Category.findByIdAndDelete(categoryId);
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
    getSettingScreen
};