const jwt = require('jsonwebtoken');
const httpStatus = require('../utility/http_status');
const User = require('../models/user_model'); // نموذج المستخدم الخاص بك
// 💡 استبدلي SECRET_KEY بالقيمة السرية الحقيقية في ملف .env
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key_default'; 


const authenticate_token = async (req, res, next) => {
    let token;

    // 1. قراءة التوكن من رأس الطلب (Authorization Header)
    // العميل يرسله عادة بصيغة: Authorization: Bearer <token>
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        // استخراج التوكن الفعلي بعد كلمة "Bearer "
        token = req.headers.authorization.split(' ')[1];
    } 
    // 💡 يمكن إضافة قراءة التوكن من ملفات تعريف الارتباط (Cookies) إذا لزم الأمر

    // 2. التحقق من وجود التوكن
    if (!token) {
      
        return res.status(401).json({  message: 'الوصول مرفوض. لا يوجد توكن.',
            statusCode: httpStatus.FAILL, 
            status: 401, });
    }

    try {

        
        // 3. التحقق من التوكن (Verification)
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // 4. استخراج المستخدم من قاعدة البيانات
        // نفترض أن حمولة التوكن تحتوي على user ID (مثل: { id: user._id })
        const currentUser = await User.findById(decoded.id);

        // 5. التحقق مما إذا كان المستخدم موجوداً
        if (!currentUser) {
          
            return res.status(401).json({
                message: 'المستخدم الذي ينتمي إليه هذا التوكن لم يعد موجودًا.',
                statusCode: httpStatus.FAILL, 
                status: 401,});
        }
   if (currentUser.token !== token) {
          
            return res.status(401).json({
                 message : 'انتهت صلاحية التوكن. يرجى تسجيل الدخول مرة أخرى.',
                statusCode: httpStatus.FAILL, 
                status: 401,});
        }
        // 6. إضافة المستخدم إلى الطلب
        req.user = currentUser;
        next();

    } catch (err) {
        // 🚨 التعامل مع أخطاء التحقق (مثل انتهاء صلاحية التوكن)
        let message = 'التوكن غير صالح أو منتهي الصلاحية.';
        console.log(err);
        // إذا كان خطأ انتهاء صلاحية التوكن (Token Expired)
        if (err.name === 'TokenExpiredError') {
             message = 'انتهت صلاحية التوكن. يرجى تسجيل الدخول مرة أخرى.';
        }
        
        return res.status(401).json({message: message,
            statusCode: httpStatus.FAILL, 
            status: 401,});
    }

};

module.exports =  authenticate_token ;