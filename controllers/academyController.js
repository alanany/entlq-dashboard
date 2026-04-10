const bcrypt = require('bcryptjs');
const { AppDataSource } = require('../config/database');

const createAcademy = async (req, res) => {
    try {
        const { academyName, adminName, adminEmail, adminPassword, subdomain } = req.body;

        const academyRepository = AppDataSource.getRepository('Academy');
        const userRepository = AppDataSource.getRepository('User');
        const systemSettingsRepository = AppDataSource.getRepository('SystemSettings');

        // 1. Create the Academy
        let newAcademy = academyRepository.create({ 
            name: academyName,
            subdomain: subdomain || academyName.toLowerCase().replace(/\s+/g, '-')
        });
        await academyRepository.save(newAcademy);

        // 2. Create the Admin for this academy
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        let admin = userRepository.create({
            name: adminName,
            email: adminEmail,
            password: hashedPassword,
            role: 'admin',
            academy: { id: newAcademy.id },
            status: 'active'
        });
        await userRepository.save(admin);

        // 3. Initialize System Settings for this academy
        let settings = systemSettingsRepository.create({
            academy: { id: newAcademy.id },
            academyName: newAcademy.name,
            academyEmail: adminEmail // Use admin email as default academy email
        });
        await systemSettingsRepository.save(settings);

        res.status(201).json({
            success: true,
            message: 'تم إنشاء الأكاديمية والأدمن بنجاح',
            academy: newAcademy,
            admin: { id: admin.id, email: admin.email }
        });
    } catch (error) {
        console.error("Error creating academy:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getSuperAdminDashboard = async (req, res) => {
    try {
        const academyRepository = AppDataSource.getRepository('Academy');
        const userRepository = AppDataSource.getRepository('User');
        const courseRepository = AppDataSource.getRepository('Course');
        const subscriptionRepository = AppDataSource.getRepository('Subscription');

        const academies = await academyRepository.find({ order: { createdAt: 'DESC' } });
        
        const enrichedAcademies = await Promise.all(academies.map(async (academy) => {
            const academyId = academy.id;

            const studentCount = await userRepository.count({ where: { academy: { id: academyId }, role: 'student' } });
            const teacherCount = await userRepository.count({ where: { academy: { id: academyId }, role: 'teacher' } });
            const courseCount = await courseRepository.count({ where: { academy: { id: academyId } } });
            
            // Get Total Revenue using QueryBuilder
            const { totalRevenue } = await subscriptionRepository.createQueryBuilder("sub")
                .select("SUM(sub.totalAmount)", "totalRevenue")
                .where("sub.academyId = :academyId", { academyId })
                .andWhere("sub.status = :status", { status: 'confirmed' })
                .getRawOne();
                
            const adminUser = await userRepository.findOne({ 
                where: { academy: { id: academyId }, role: 'admin' },
                select: ['id', 'email'] 
            });

            return {
                ...academy,
                stats: {
                    students: studentCount,
                    teachers: teacherCount,
                    courses: courseCount,
                    revenue: parseFloat(totalRevenue) || 0
                },
                adminEmail: adminUser ? adminUser.email : 'لا يوجد'
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
        const academyRepository = AppDataSource.getRepository('Academy');
        
        await academyRepository.update(academyId, { status });
        res.json({ success: true, message: 'تم تحديث حالة الأكاديمية بنجاح' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteAcademy = async (req, res) => {
    try {
        const academyId = req.params.id;
        const academyRepository = AppDataSource.getRepository('Academy');
        
        await academyRepository.delete(academyId);
        // Cascades should handle relating data if specified in Schema relations, or explicitly deleted here.
        res.json({ success: true, message: 'تم حذف الأكاديمية بنجاح' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getSuperAdminLogin = (req, res) => {
    res.render('dashboard/superadmin/login');
};

const getSuperAdminSetup = async (req, res) => {
    try {
        const userRepository = AppDataSource.getRepository('User');
        const existing = await userRepository.findOne({ where: { role: 'superadmin' } });
        res.render('dashboard/superadmin/setup', { superadminExists: !!existing });
    } catch (error) {
        console.error("Error loading setup page:", error);
        res.status(500).send("خطأ في تحميل صفحة الإعداد");
    }
};

const createSuperAdmin = async (req, res) => {
    try {
        const { name, email, password, setupKey } = req.body;

        // Validate setup key from environment
        const validSetupKey = process.env.SETUP_KEY || 'superadmin2026';
        if (setupKey !== validSetupKey) {
            return res.status(403).json({ success: false, message: 'مفتاح الإعداد غير صحيح' });
        }

        // Validate inputs
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'يرجى تعبئة جميع الحقول المطلوبة' });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
        }

        const userRepository = AppDataSource.getRepository('User');

        // Check if superadmin already exists
        const existing = await userRepository.findOne({ where: { role: 'superadmin' } });
        if (existing) {
            return res.status(400).json({ success: false, message: 'حساب المدير العام موجود بالفعل' });
        }

        // Check email uniqueness
        const emailExists = await userRepository.findOne({ where: { email: email.trim().toLowerCase() } });
        if (emailExists) {
            return res.status(400).json({ success: false, message: 'البريد الإلكتروني مستخدم بالفعل' });
        }

        // Create superadmin
        const hashedPassword = await bcrypt.hash(password, 12);
        const superAdmin = userRepository.create({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password: hashedPassword,
            role: 'superadmin',
            status: 'active'
        });
        await userRepository.save(superAdmin);

        res.status(201).json({ 
            success: true, 
            message: 'تم إنشاء حساب المدير العام بنجاح' 
        });
    } catch (error) {
        console.error("Error creating superadmin:", error);
        res.status(500).json({ success: false, message: 'حدث خطأ أثناء إنشاء الحساب' });
    }
};

module.exports = {
    createAcademy,
    getSuperAdminDashboard,
    toggleAcademyStatus,
    deleteAcademy,
    getSuperAdminLogin,
    getSuperAdminSetup,
    createSuperAdmin,
    getAllAcademies: async (req, res) => {
        try {
            const academyRepository = AppDataSource.getRepository('Academy');
            const academies = await academyRepository.find();
            res.status(200).json(academies);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
};
