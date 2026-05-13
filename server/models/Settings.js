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
  /** Shown on every destination detail page — generic visa requirement bullets (global default). */
  destinationVisaRequirements: [{ type: String, trim: true }],

  /**
   * Universal "Visa Type" applied to every country whose `useGlobalVisaType` flag is
   * true. Admin changes this from Admin → Controls → Universal visa type control.
   * Empty string means "no global set — fall back to the per-country `visaType`".
   */
  globalVisaType: { type: String, default: '', trim: true },
  /** Universal "Validity" applied the same way. */
  globalValidity: { type: String, default: '', trim: true },
  /** Universal "Processing Days" (free text e.g. "5-10", "2-3 weeks") applied the same way. */
  globalProcessingDays: { type: String, default: '', trim: true },

  /**
   * Universal "Required Documents" — applied to every country whose
   * `useGlobalRequiredDocuments` flag is true. Stored as an ordered list of
   * doc keys; the labels come from the merged catalog (built-in + custom).
   */
  globalRequiredDocuments: [{ type: String, trim: true }],

  /**
   * Admin-added document types extending the built-in catalog. Each entry is
   * `{ key, label }`. Keys are auto-prefixed with `custom_` on the server so
   * built-ins can never be accidentally overwritten.
   */
  customDocuments: [{
    key: { type: String, trim: true, required: true },
    label: { type: String, trim: true, required: true },
  }],

  /**
   * Display toggles — when an admin turns a field off, every public country card and
   * the country details page hides that field. Stored on Settings so the toggle is
   * the same across all countries (admins can still override the underlying *value*
   * per country independently via Country Manager).
   */
  showVisaType: { type: Boolean, default: true },
  showValidity: { type: Boolean, default: true },
  showProcessingDays: { type: Boolean, default: true },
  showRequiredDocuments: { type: Boolean, default: true },
}, {
  timestamps: true
});

module.exports = mongoose.model('Settings', settingsSchema);
