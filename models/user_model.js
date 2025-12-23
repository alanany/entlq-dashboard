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
  },
  hour_rate: {
    type: Number,
  },
  image: {
    type: String,
  },
notes: { type: String },
    token: {
      type: String,
    }

});


// fire a function before doc saved to db

userSchema.pre('save', function(next) {
  if (!this.isModified('password')) return next();
  this.password = bcrypt.hashSync(this.password, 10);
  next();
});


const User = mongoose.model('user', userSchema);

module.exports = User;