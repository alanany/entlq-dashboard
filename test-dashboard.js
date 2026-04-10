const { AppDataSource } = require('./config/database');

async function test() {
    await AppDataSource.initialize();
    const subscriptionRepository = AppDataSource.getRepository('Subscription');
    try {
        const { totalRevenue } = await subscriptionRepository.createQueryBuilder("sub")
            .select("SUM(sub.totalAmount)", "totalRevenue")
            .where("sub.academyId = :academyId", { academyId: 1 })
            .getRawOne();
        console.log("totalRevenue:", totalRevenue);
    } catch(e) {
        console.error("ERROR:", e.message);
    }
    process.exit(0);
}
test();
