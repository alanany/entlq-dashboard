const mongoose = require('mongoose');
const User = require('./models/user_model');
const Course = require('./models/course_model');
const Subscription = require('./models/subscription_model');
const Academy = require('./models/academy_model');

const mongoURI = "mongodb://admin:123admin@ac-viyaull-shard-00-00.f8e6eew.mongodb.net:27017,ac-viyaull-shard-00-01.f8e6eew.mongodb.net:27017,ac-viyaull-shard-00-02.f8e6eew.mongodb.net:27017/educationPlatform?replicaSet=atlas-t4lptn-shard-0&ssl=true&authSource=admin";

async function fixData() {
    try {
        await mongoose.connect(mongoURI);
        console.log("Connected to DB");

        // 1. جلب أول أكاديمية موجودة
        let academy = await Academy.findOne({ name: /Alefbaa/i }) || await Academy.findOne({});
        
        if (!academy) {
            console.log("Creating default academy...");
            academy = await Academy.create({ name: "أكاديمية النخبة", status: 'active' });
        }

        const academyId = academy._id;
        console.log(`Target Academy: ${academy.name} (${academyId})`);

        // 2. تحديث حسابات الأدمن/السوبر أدمن غير المرتبطة
        const userUpdate = await User.updateMany(
            { academyId: null, role: { $in: ['admin', 'superadmin', 'supervisor'] } },
            { $set: { academyId: academyId } }
        );
        console.log(`Updated Admins: ${userUpdate.modifiedCount}`);

        // 3. تحديث الدورات غير المرتبطة
        const courseUpdate = await Course.updateMany(
            { academyId: null },
            { $set: { academyId: academyId } }
        );
        console.log(`Updated Courses: ${courseUpdate.modifiedCount}`);

        // 4. تحديث الاشتراكات غير المرتبطة
        const subUpdate = await Subscription.updateMany(
            { academyId: null },
            { $set: { academyId: academyId } }
        );
        console.log(`Updated Subscriptions: ${subUpdate.modifiedCount}`);

        // 5. تحديث الطلاب غير المرتبطين
        const studentUpdate = await User.updateMany(
            { academyId: null, role: 'student' },
            { $set: { academyId: academyId } }
        );
        console.log(`Updated Students: ${studentUpdate.modifiedCount}`);

        console.log("DONE! Please refresh your dashboard.");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

fixData();
