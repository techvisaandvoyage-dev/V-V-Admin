const mongoose = require('mongoose');

const OtpSchema = new mongoose.Schema({
  identifier: { // Can be email or phone
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  otp: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    enum: ['signup', 'login', 'password_reset'],
    default: 'signup'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    // Document expires 10 minutes after creation
    expires: 600
  }
});

module.exports = mongoose.model('Otp', OtpSchema);
