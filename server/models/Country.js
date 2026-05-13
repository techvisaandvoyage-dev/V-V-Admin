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
  /**
   * Per-country visa type override. When `useGlobalVisaType` is true the public API
   * resolves this to `Settings.globalVisaType` before responding, so cards/details
   * always show the same shape regardless of where the value originates.
   */
  visaType: { type: String, default: 'Tourist Visa' },
  /** If true, public responses ignore this country's `visaType` and use the global default. */
  useGlobalVisaType: { type: Boolean, default: true },

  /** Stay validity shown on country cards (free text, e.g. "30 days", "90 days", "1 year"). */
  validity: { type: String, default: '' },
  /** If true, public responses ignore this country's `validity` and use the global default. */
  useGlobalValidity: { type: Boolean, default: true },
  /** If true, public responses ignore this country's `processingDays` and use the global default. */
  useGlobalProcessingDays: { type: Boolean, default: true },
  continent: { type: String, default: 'Global' },
  imageUrl: { type: String, default: '' },
  description: { type: String, default: '' },

  /** Free-text visa requirements shown to the applicant */
  requirements: [{ type: String }],

  /**
   * Document types the applicant must upload for this country.
   * Built-in keys: passport | idCard | dobCertificate | photo | bankStatement |
   * travelInsurance | flightTicket | hotelBooking | coverLetter |
   * invitationLetter | employmentLetter | taxReturn | marriageCertificate.
   * Admin-added custom documents use the `custom_<slug>` key shape.
   */
  requiredDocuments: [{ type: String }],
  /** If true, public responses ignore this country's `requiredDocuments` and use the global list. */
  useGlobalRequiredDocuments: { type: Boolean, default: true },

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
  /** Hide specific global visa-requirement bullets on this country only. */
  excludeDestinationVisaRequirements: [{ type: String, trim: true }],
}, { timestamps: true });

module.exports = mongoose.model('Country', countrySchema);
