const mongoose = require('mongoose');
const User = require('./models/user_model');
const Course = require('./models/course_model');
const Subscription = require('./models/subscription_model');

const mongoURI = "mongodb://admin:123admin@ac-viyaull-shard-00-00.f8e6eew.mongodb.net:27017,ac-viyaull-shard-00-01.f8e6eew.mongodb.net:27017,ac-viyaull-shard-00-02.f8e6eew.mongodb.net:27017/educationPlatform?replicaSet=atlas-t4lptn-shard-0&ssl=true&authSource=admin";

async function testStats() {
    try {
        await mongoose.connect(mongoURI);
        console.log("Connected to DB");

        // Get the admin user that logs in
        const admins = await User.find({ role: 'admin' }).lean();
        console.log("--- ALL ADMINS ---");
        admins.forEach(a => {
            console.log(`Name: ${a.name}, academyId: ${a.academyId}, type: ${typeof a.academyId}`);
        });

        // Pick the first admin with an academyId
        const admin = admins.find(a => a.academyId);
        if (!admin) {
            console.log("No admin with academyId found!");
            process.exit(1);
        }

        const academyId = admin.academyId.toString();
        const academyObjectId = new mongoose.Types.ObjectId(academyId);
        console.log("\n--- TESTING WITH ACADEMY ID:", academyId, "---");

        // Test each count individually
        const studentCount = await User.countDocuments({ role: 'student', academyId: academyObjectId });
        const teacherCount = await User.countDocuments({ role: 'teacher', academyId: academyObjectId });
        const courseCount = await Course.countDocuments({ academyId: academyObjectId });
        const subCount = await Subscription.countDocuments({ academyId: academyObjectId });

        console.log("Students:", studentCount);
        console.log("Teachers:", teacherCount);
        console.log("Courses:", courseCount);
        console.log("Subscriptions:", subCount);

        // Check: are academyIds stored as strings or ObjectIds?
        const sampleStudent = await User.findOne({ role: 'student', academyId: { $exists: true, $ne: null } }).lean();
        if (sampleStudent) {
            console.log("\nSample student academyId:", sampleStudent.academyId, "type:", typeof sampleStudent.academyId);
            console.log("Is ObjectId?", sampleStudent.academyId instanceof mongoose.Types.ObjectId);
        }

        // Try with string comparison
        const studentCountStr = await User.countDocuments({ role: 'student', academyId: academyId });
        console.log("Students (string match):", studentCountStr);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

testStats();
