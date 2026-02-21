const mongoose = require('mongoose');
const User = require('./models/user_model');
const Course = require('./models/course_model');
const Subscription = require('./models/subscription_model');
const Academy = require('./models/academy_model');

const mongoURI = "mongodb://admin:123admin@ac-viyaull-shard-00-00.f8e6eew.mongodb.net:27017,ac-viyaull-shard-00-01.f8e6eew.mongodb.net:27017,ac-viyaull-shard-00-02.f8e6eew.mongodb.net:27017/educationPlatform?replicaSet=atlas-t4lptn-shard-0&ssl=true&authSource=admin";

async function checkData() {
    try {
        await mongoose.connect(mongoURI); 
        console.log("Connected to DB");

        const userCounts = await User.aggregate([{ $group: { _id: "$academyId", count: { $sum: 1 } } }]);
        const subCounts = await Subscription.aggregate([{ $group: { _id: "$academyId", count: { $sum: 1 } } }]);
        const courseCounts = await Course.aggregate([{ $group: { _id: "$academyId", count: { $sum: 1 } } }]);
        const academies = await Academy.find({});

        console.log("--- COUNTS BY ACADEMY ---");
        console.log("User counts:", userCounts);
        console.log("Subscription counts:", subCounts);
        console.log("Course counts:", courseCounts);
        if (academies.length > 0) {
            console.log("Sample Academy ID:", academies[0]._id);
        }

        const privilegedUsers = await User.find({ role: { $in: ['admin', 'superadmin', 'supervisor'] } }).populate('academyId');
        console.log("--- PRIVILEGED USERS ---");
        privilegedUsers.forEach(u => {
            console.log(`User: ${u.name}, Role: ${u.role}, Academy: ${u.academyId ? u.academyId.name + ' (' + u.academyId._id + ')' : 'NULL'}`);
        });

        if (academies.length > 0) {
            console.log("--- ACADEMIES ---");
            academies.forEach(a => console.log(`Academy: ${a.name}, ID: ${a._id}`));
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
