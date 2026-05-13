const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  // Since this is a global settings object, we'll enforce a single document
  singleton: {
    type: String,
    default: 'global',
    unique: true
  },
  razorpayKeyId: {
    type: String,
    default: ''
  },
  razorpayKeySecret: {
    type: String,
    default: ''
  },
  firebaseApiKey: {
    type: String,
    default: ''
  },
  firebaseAuthDomain: {
    type: String,
    default: ''
  },
  firebaseProjectId: {
    type: String,
    default: ''
  },
  googleClientId: {
    type: String,
    default: ''
  },
  googleClientSecret: {
    type: String,
    default: ''
  },
  firebaseStorageBucket: {
    type: String,
    default: ''
  },
  firebaseMessagingSenderId: {
    type: String,
    default: ''
  },
  firebaseAppId: {
    type: String,
    default: ''
  },
  firebaseServiceAccountJson: {
    type: String,
    default: ''
  },
  sms91AuthKey: {
    type: String,
    default: ''
  },
  sms91TemplateId: {
    type: String,
    default: ''
  },
  sms91OtpLength: {
    type: String,
    default: '6'
  },
  /** Nodemailer — used for signup, login, and forgot-password OTP when set (overrides EMAIL_* env). */
  smtpEmailUser: {
    type: String,
    default: ''
  },
  smtpEmailPass: {
    type: String,
    default: ''
  },
  smtpEmailService: {
    type: String,
    default: ''
  },
  enableGDriveUpload: {
    type: Boolean,
    default: true
  },
  enableFileUpload: {
    type: Boolean,
    default: true
  },
  /** Unsplash — used by `node fetchCountryImages.js` (Access Key required; secret/app id optional / reference). */
  unsplashAccessKey: {
    type: String,
    default: ''
  },
  unsplashSecretKey: {
    type: String,
    default: ''
  },
  unsplashApplicationId: {
    type: String,
    default: ''
  },
  /** Shown on every destination detail page — "Why book now?" bullets (global default). */
  destinationWhyBookNow: [{ type: String, trim: true }],
  /** Shown on every destination detail page — "What's included" bullets (global default). */
  destinationIncludedItems: [{ type: String, trim: true }],
  /** Shown on every destination detail page — FAQ list (global default). */
  destinationFaqs: [{
    question: { type: String, trim: true, default: '' },
    answer: { type: String, trim: true, default: '' },
  }],
  /** Shown on every destination detail page — numbered "How it works" steps (global default). */
  destinationHowItWorks: [{
    title: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
  }],
}, {
  timestamps: true
});

module.exports = mongoose.model('Settings', settingsSchema);
