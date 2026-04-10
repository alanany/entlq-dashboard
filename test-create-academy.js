const { AppDataSource } = require('./config/database');
const bcrypt = require('bcryptjs');

async function test() {
    await AppDataSource.initialize();

    const academyName = 'Test Acad';
    const adminName = 'Admin';
    const adminEmail = 'admin@tst.com';
    const adminPassword = 'password123';
    const subdomain = 'test-acad';

    const academyRepository = AppDataSource.getRepository('Academy');
    const userRepository = AppDataSource.getRepository('User');
    const systemSettingsRepository = AppDataSource.getRepository('SystemSettings');

    try {
        let newAcademy = academyRepository.create({ 
            name: academyName,
            subdomain: subdomain
        });
        await academyRepository.save(newAcademy);
        console.log("Academy created:", newAcademy.id);

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
        console.log("Admin created:", admin.id);

        let settings = systemSettingsRepository.create({
            academy: { id: newAcademy.id },
            academyName: newAcademy.name,
            academyEmail: adminEmail // Use admin email as default academy email
        });
        await systemSettingsRepository.save(settings);
        console.log("Settings created:", settings.id);

    } catch (e) {
        console.error("ERROR:", e);
    }
    
    process.exit(0);
}

test();
