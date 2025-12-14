const mongoose = require('mongoose');
const { isEmail } = require('validator');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Please enter an email'],
    unique: true,
    lowercase: true,
    validate: [isEmail, 'Please enter a valid email']
  },
  country_code: {
    type: String,
    required: [true, 'Please enter a country code'],
  },
  gender: {
    type: String,
    required: [true, 'Please enter a gender'],
  },
  phone_number: {
    type: String,
    required: [true, 'Please enter a phone number'],
  },
   name: {
    type: String,
    required: [true, 'Please enter your name'],
  },

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
  status:{
    type: String,
    enum: ['active', 'banned'],
    default: 'active'
  }
});


// fire a function before doc saved to db
userSchema.pre('save', async function(next) {
  const salt = await bcrypt.genSalt();
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const User = mongoose.model('user', userSchema);

module.exports = User;