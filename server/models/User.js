const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  /** Optional handle for @mentions in blog comments (sparse, unique when set) */
  username: {
    type: String,
    sparse: true,
    unique: true,
    trim: true,
    lowercase: true,
    maxlength: 32,
    match: [/^[a-z0-9_]+$/, 'Username may only contain lowercase letters, numbers, and underscores'],
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
    // Not stored when user signs in via Firebase (Google or Email/Password)
    required: function() {
      return !this.googleId && !this.facebookId && !this.firebaseUid;
    },
    validate: {
      validator: function(v) {
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
  },
  facebookId: {
    type: String,
    sparse: true,
    unique: true
  },
  firebaseUid: {
    type: String,
    sparse: true,
    unique: true,
    trim: true
  }
}, { timestamps: true });

UserSchema.pre('save', async function() {
  if (!this.isModified('password') || !this.password) return;
  if (this.password.startsWith('$2b$')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model('User', UserSchema);
