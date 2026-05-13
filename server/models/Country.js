const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema({
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  name: { type: String, required: true, trim: true },
  flagEmoji: { type: String, default: '🌍' },
  basePrice: { type: Number, required: true, default: 0 },
  processingDays: { type: String, default: '5-10' },
  difficulty: {
    type: String,
    enum: ['easy', 'moderate', 'hard'],
    default: 'moderate',
  },
  visaType: { type: String, default: 'Tourist Visa' },
  continent: { type: String, default: 'Global' },
  imageUrl: { type: String, default: '' },
  description: { type: String, default: '' },

  /** Free-text visa requirements shown to the applicant */
  requirements: [{ type: String }],

  /**
   * Document types the applicant must upload for this country.
   * Supported keys: passport | idCard | dobCertificate | photo | bankStatement | travelInsurance
   */
  requiredDocuments: [{ type: String }],

  trending: { type: Boolean, default: false },
  successRate: { type: Number, default: 80, min: 0, max: 100 },

  /**
   * Destination detail page copy (per-country override).
   * Empty arrays fall back to the global `Settings.destination*` defaults on the client.
   */
  whyBookNow: [{ type: String, trim: true }],
  includedItems: [{ type: String, trim: true }],
  faqs: [{
    question: { type: String, trim: true, default: '' },
    answer: { type: String, trim: true, default: '' },
  }],
  /** Numbered "How it works" steps shown on the destination page. */
  howItWorks: [{
    title: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
  }],

  /**
   * Hide specific global destination lines on this country only (keys are
   * lowercase trimmed text for bullets, lowercase trimmed question for FAQs,
   * lowercase trimmed title for "How it works" steps).
   */
  excludeDestinationWhyBookNow: [{ type: String, trim: true }],
  excludeDestinationIncludedItems: [{ type: String, trim: true }],
  excludeDestinationFaqQuestions: [{ type: String, trim: true }],
  excludeDestinationHowItWorksTitles: [{ type: String, trim: true }],
}, { timestamps: true });

module.exports = mongoose.model('Country', countrySchema);
