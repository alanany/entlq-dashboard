const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { AppDataSource } = require('../config/database');

// handle errors
const handleErrors = (err) => {
  console.log(err.message, err.code);
  let errors = { email: '', password: '' };

  // incorrect email
  if (err.message === 'incorrect email') {
    errors.email = 'That email is not registered';
  }

  // incorrect password
  if (err.message === 'incorrect password') {
    errors.password = 'That password is incorrect';
  }

  // duplicate email error (MySQL duplicate entry)
  if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
    errors.email = 'that email is already registered';
    return errors;
  }

  // validation errors (Mongoose specific, not usually thrown by TypeORM in same way, but catch general throw)
  if (err.message.includes('Validation')) {
    errors.general = err.message;
  }

  return errors;
}

// create json web token
const maxAge = 3 * 24 * 60 * 60;
const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: maxAge
  });
};

// controller actions
module.exports.signup_get = (req, res) => {
  res.render('../views/dashboard/admin_register');
}

module.exports.login_get = (req, res) => {
  res.render('../views/dashboard/login');
}

module.exports.signup_post = async (req, res) => {
  const { email, password, name, role, academyId } = req.body;
  console.log(req.body);
  try {
    const userRepository = AppDataSource.getRepository('User');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user object. Map academyId to the academy relation.
    const userPayload = { 
        email, 
        password: hashedPassword, 
        name, 
        role 
    };
    if (academyId) {
        userPayload.academy = { id: parseInt(academyId) };
    }

    const user = userRepository.create(userPayload);
    await userRepository.save(user);
    
    console.log(user);
    const token = createToken(user.id);
    console.log(token);
    res.cookie('jwt', token, { httpOnly: true, maxAge: maxAge * 1000 });
    res.status(200).json({ user: user.id });

  } catch(err) {
    const errors = handleErrors(err);
    console.log(errors);
    res.status(400).json({ errors });
  }
}

module.exports.login_post = async (req, res) => {
    console.log(req.body);

    const { email, password, role, timezone } = req.body;
    const normalizedEmail = email ? email.trim().toLowerCase() : '';
    
    let errors = {}; 

    try {
        const userRepository = AppDataSource.getRepository('User');
        const academyRepository = AppDataSource.getRepository('Academy');

        const user = await userRepository.findOne({ 
            where: { email: normalizedEmail, role: role },
            relations: ['academy'] // Load academy relationship to check status
        });

        if (!user) {
            errors.email = 'هذا البريد الإلكتروني غير صحيح';
            return res.status(400).json({ errors });
        }

        const auth = await bcrypt.compare(password, user.password);
        
        if (!auth) {
            errors.password = 'كلمة المرور المدخلة غير صحيحة';
            return res.status(400).json({ errors });
        } 

        if (user.academy) {
            if (user.academy.status === 'suspended') {
                errors.email = 'تم حظر هذه الأكاديمية مؤقتاً. يرجى التواصل مع الإدارة.';
                return res.status(403).json({ errors });
            }
        }

        if (timezone && user.timezone !== timezone) {
            user.timezone = timezone;
            await userRepository.save(user);
            console.log(`تم تحديث توقيت المستخدم إلى: ${timezone}`);
        }

        const token = createToken(user.id);
        res.cookie('jwt', token, { httpOnly: true, maxAge: maxAge * 1000 });
        
        return res.status(200).json({ user: user.id, role: user.role, message: "تم تسجيل الدخول بنجاح." });

    } catch (err) {
        console.error(err);
        const specificErrors = handleErrors(err); 
        return res.status(400).json({ errors: specificErrors });
    }
}

module.exports.logout_get = (req, res) => {
  res.cookie('jwt', '', { maxAge: 1 });
  res.redirect('/');
}

module.exports.student_logout_get = (req, res) => {
  res.cookie('jwt', '', { maxAge: 1 });
  res.redirect('/landing');
}