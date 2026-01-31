const admin = require("firebase-admin");

// 1. يفضل وضع المسار في متغير بيئة .env للأمان
const serviceAccount = require("../utility/serviceAccountKey.json");
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

/**
 * دالة ذكية لإرسال الإشعارات
 * @param {string|string[]} target - توكن واحد أو مصفوفة توكنات
 * @param {object} content - { title, body, data, image }
 */
const sendPushNotification = async (target, content) => {
    try {
        const message = {
            notification: {
                title: content.title,
                body: content.body
            },
            // الداتا اللي بتستلمها في فلاتر وهي مغلقة لتوجيه المستخدم
            data: content.data || {}, 
            android: {
                priority: "high",
                notification: {
                    sound: "default",
                    clickAction: "FLUTTER_NOTIFICATION_CLICK"
                }
            },
            apns: {
                payload: {
                    aps: { badge: 1, sound: "default" }
                }
            }
        };

        if (Array.isArray(target)) {
            // إرسال لمجموعة (Multicast)
            message.tokens = target;
            const response = await admin.messaging().sendEachForMulticast(message);
            console.log(`${response.successCount} messages sent successfully`);
            
            // هندسة التوكنات المنتهية:
            if (response.failureCount > 0) {
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        handleInvalidToken(target[idx], resp.error.code);
                    }
                });
            }
            return response;
        } else {
            // إرسال لجهاز واحد
            message.token = target;
            const response = await admin.messaging().send(message);
            return response;
        }
    } catch (error) {
        console.error("FCM Error:", error);
        throw error;
    }
};

// دالة لتنظيف قاعدة البيانات من التوكنات القديمة
function handleInvalidToken(token, errorCode) {
    if (errorCode === 'messaging/registration-token-not-registered' || 
        errorCode === 'messaging/invalid-registration-token') {
        console.warn(`Cleaning up invalid token: ${token}`);
        // هنا تضع كود Delete من الـ Database الخاصة بك
    }
}

module.exports = { sendPushNotification };