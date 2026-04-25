const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    sparse: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    sparse: true,
    unique: true,
    trim: true
  },
  age: {
    type: Number,
    min: 0
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other']
  },
  passportNumber: {
    type: String,
    sparse: true,
    unique: true,
    trim: true
  },
  profileImage: {
    type: String // Path to uploaded image
  },
  password: {
    type: String,
    // Required unless it's a Google OAuth user
    required: function() {
      return !this.googleId;
    },
    validate: {
      validator: function(v) {
        // If empty (because googleId exists), let it pass
        if (!v) return true;
        // Skip strength validation for already hashed bcrypt strings
        if (typeof v === 'string' && v.startsWith('$2b$')) return true;
        
        // Strict Regex: Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        return regex.test(v);
      },
      message: 'Password must contain at least 8 characters, one uppercase, one lowercase, one number and one special character.'
    }
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  googleId: {
    type: String,
    sparse: true,
    unique: true
  }
}, { timestamps: true });

UserSchema.pre('save', async function() {
  if (!this.isModified('password') || !this.password) return;
  if (this.password.startsWith('$2b$')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model('User', UserSchema);
