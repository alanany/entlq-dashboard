const Academy = require('../models/academy_model');
const User = require('../models/user_model');
const Subscription = require('../models/subscription_model');
const Course = require('../models/course_model');

// This controller would be used by a "Super Admin" to manage various academies
const createAcademy = async (req, res) => {
    try {
        const { academyName, adminName, adminEmail, adminPassword, subdomain } = req.body;

        // 1. Create the Academy
        const academy = await Academy.create({ 
            name: academyName,
            subdomain: subdomain || academyName.toLowerCase().replace(/\s+/g, '-')
        });

        // 2. Create the Admin for this academy
        const admin = await User.create({
            name: adminName,
            email: adminEmail,
            password: adminPassword,
            role: 'admin',
            academyId: academy._id,
            status: 'active'
        });

        res.status(201).json({
            success: true,
            message: 'تم إنشاء الأكاديمية والأدمن بنجاح',
            academy,
            admin: { id: admin._id, email: admin.email }
        });
    } catch (error) {
        console.error("Error creating academy:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getSuperAdminDashboard = async (req, res) => {
    try {
        const academies = await Academy.find().sort({ createdAt: -1 });
        
        // Get stats for each academy
        const enrichedAcademies = await Promise.all(academies.map(async (academy) => {
            const academyId = academy._id;
            const [studentCount, teacherCount, courseCount, revenue] = await Promise.all([
                User.countDocuments({ academyId, role: 'student' }),
                User.countDocuments({ academyId, role: 'teacher' }),
                Course.countDocuments({ academyId }),
                Subscription.aggregate([
                    { $match: { academyId, status: 'confirmed' } },
                    { $group: { _id: null, total: { $sum: "$totalAmount" } } }
                ])
            ]);

            return {
                ...academy.toObject(),
                stats: {
                    students: studentCount,
                    teachers: teacherCount,
                    courses: courseCount,
                    revenue: revenue[0]?.total || 0
                }
            };
        }));

        const globalStats = {
            totalAcademies: academies.length,
            activeAcademies: academies.filter(a => a.status === 'active').length,
            totalRevenue: enrichedAcademies.reduce((acc, curr) => acc + curr.stats.revenue, 0)
        };

        res.render('dashboard/superadmin/index', {
            academies: enrichedAcademies,
            globalStats,
            user: req.user,
            title: 'لوحة تحكم المدير العام'
        });
    } catch (error) {
        console.error("Error loading superadmin dashboard:", error);
        res.status(500).send("خطأ في تحميل لوحة التحكم");
    }
};

const toggleAcademyStatus = async (req, res) => {
    try {
        const { academyId, status } = req.body;
        await Academy.findByIdAndUpdate(academyId, { status });
        res.json({ success: true, message: 'تم تحديث حالة الأكاديمية بنجاح' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteAcademy = async (req, res) => {
    try {
        const academyId = req.params.id;
        // In a real scenario, you might want to perform a cascade delete or archive
        await Academy.findByIdAndDelete(academyId);
        // Also delete associated users and data if needed
        res.json({ success: true, message: 'تم حذف الأكاديمية بنجاح' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createAcademy,
    getSuperAdminDashboard,
    toggleAcademyStatus,
    deleteAcademy,
    getAllAcademies: async (req, res) => {
        try {
            const academies = await Academy.find();
            res.status(200).json(academies);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
};
