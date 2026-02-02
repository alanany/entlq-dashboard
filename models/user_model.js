const mongoose = require('mongoose');
const { isEmail } = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Please enter an email'],
    unique: true,
    lowercase: true,
    validate: [isEmail, 'Please enter a valid email']
  },
  devices: [{
    fcmToken: { type: String, required: true },
    platform: { type: String, enum: ['android', 'ios', 'web'] },
    deviceModel: String, // مفيد لتتبع المشاكل التقنية
    lastUsed: { type: Date, default: Date.now }
  }],
  country_code: {
    type: String,
  },
  gender: {
    type: String,
  },
  phone_number: {
    type: String,
  },
   name: {
    type: String,
  },
zoom_link: {
    type: String,
  },  
  isActive: { type: Boolean, default: true }, // الحقل الجديد
  password: {
    type: String,
    required: [true, 'Please enter a password'],
    minlength: [6, 'Minimum password length is 6 characters'],
  },
  role:{
    type: String,
    enum: ['admin', 'student', 'teacher'],
    default: 'student'
  },
  timezone: { type: String, default: 'UTC' }, // مثال: 'Asia/Riyadh'
  status:{
    type: String,
    enum: ['active', 'archived'],
    default: 'active'
  },
  hour_rate: { type: Number, default: 0 },
  hourly_rates: [{
    label: { type: String },
    rate: { type: Number }
  }],
  image: {
    type: String,
  },
notes: { type: String },
    token: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },

});


// fire a function before doc saved to db

userSchema.pre('save', function(next) {
  if (!this.isModified('password')) return next();
  this.password = bcrypt.hashSync(this.password, 10);
  next();
});


const User = mongoose.model('user', userSchema);

module.exports = User;