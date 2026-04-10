const { AppDataSource } = require('./config/database');

async function test() {
    await AppDataSource.initialize();
    
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
                .getRawOne() || { totalRevenue: 0 };
                
            const adminUser = await userRepository.findOne({ 
                where: { academy: { id: academyId }, role: 'admin' },
                select: ['email'] 
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

        console.log("enrichedAcademies built successfully");
        console.log(enrichedAcademies[0]);
    } catch(e) {
        console.error("ERROR in getSuperAdminDashboard logic:", e);
    }
    process.exit(0);
}
test();
