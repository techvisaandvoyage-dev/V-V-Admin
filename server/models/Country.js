const mongoose = require('mongoose');

const visaInformationItemSchema = new mongoose.Schema({
  id: { type: String, trim: true, default: '' },
  enabled: { type: Boolean, default: true },
  label: { type: String, trim: true, default: '' },
  value: { type: String, trim: true, default: '' },
  description: { type: String, trim: true, default: '' },
  icon: { type: String, trim: true, default: '' },
  color: { type: String, trim: true, default: 'blue' },
}, { _id: false });

const visaInformationSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true },
  badgeText: { type: String, trim: true, default: '100% Online Process' },
  title: { type: String, trim: true, default: 'Visa Information' },
  subtitle: {
    type: String,
    trim: true,
    default: 'A 100% online visa application process that is simple, secure and hassle-free.',
  },
  note: {
    type: String,
    trim: true,
    default: 'Visa rules and conditions may change. Please check the latest requirements before applying.',
  },
  items: {
    type: [visaInformationItemSchema],
    default: () => ([
      {
        id: 'lengthOfStay',
        enabled: true,
        label: 'Length of Stay',
        value: '',
        description: 'You can stay up to the approved duration in the country.',
        icon: 'calendar',
        color: 'blue',
      },
      {
        id: 'validity',
        enabled: true,
        label: 'Validity',
        value: '',
        description: 'Your visa remains valid for the approved duration after issue.',
        icon: 'clock3',
        color: 'green',
      },
      {
        id: 'entry',
        enabled: true,
        label: 'Entry',
        value: '',
        description: 'This visa determines how many times you can enter the country.',
        icon: 'door-open',
        color: 'purple',
      },
    ]),
  },
}, { _id: false });

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
  useGlobalBasePrice: { type: Boolean, default: false },
  governmentFee: { type: Number, default: 0 },
  useGlobalGovernmentFee: { type: Boolean, default: true },
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
  /** Length of stay shown on the destination Visa Information section. */
  lengthOfStay: { type: String, default: '' },
  /** If true, public responses ignore this country's `lengthOfStay` and use the global default. */
  useGlobalLengthOfStay: { type: Boolean, default: true },
  /** Entry type shown on the destination Visa Information section (e.g. Single Entry). */
  entryType: { type: String, default: '' },
  /** If true, public responses ignore this country's `entryType` and use the global default. */
  useGlobalEntryType: { type: Boolean, default: true },
  /** Premium Visa Information section shown on the destination page. */
  visaInformation: {
    type: visaInformationSchema,
    default: () => ({}),
  },
  /** If true, public responses ignore this country's `processingDays` and use the global default. */
  useGlobalProcessingDays: { type: Boolean, default: true },

  /** Per-country GST override. If true, the country uses its own GST settings; otherwise global settings apply. */
  useGlobalGst: { type: Boolean, default: true },
  /** If `useGlobalGst` is false, this value is used for the country payment summary. */
  gstEnabled: { type: Boolean },
  /** If `useGlobalGst` is false, this rate is used for the country payment summary. */
  gstRate: { type: Number, min: 0 },

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
   * When `useGlobal*` is true, the section merges global defaults with these extras.
   * When `useGlobal*` is false, only these items are shown.
   */
  whyBookNow: [{ type: String, trim: true }],
  useGlobalWhyBookNow: { type: Boolean, default: true },
  includedItems: [{
    title: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    icon: { type: String, trim: true, default: '' },
    color: { type: String, trim: true, default: 'blue' },
  }],
  useGlobalIncludedItems: { type: Boolean, default: true },
  faqs: [{
    question: { type: String, trim: true, default: '' },
    answer: { type: String, trim: true, default: '' },
  }],
  useGlobalFaqs: { type: Boolean, default: true },
  /** Numbered "How it works" steps shown on the destination page. */
  howItWorks: [{
    title: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
  }],
  useGlobalHowItWorks: { type: Boolean, default: true },
  /** Per-country extra requirements. Merged with global defaults if useGlobal* is true. */
  useGlobalVisaRequirements: { type: Boolean, default: true },
  
  /**
   * Hide specific global destination lines on this country only (keys are
   * lowercase trimmed text for bullets, lowercase trimmed question for FAQs,
   * lowercase trimmed title for "How it works" steps).
   * Only used when `useGlobal*` is true.
   */
  excludeDestinationWhyBookNow: [{ type: String, trim: true }],
  excludeDestinationIncludedItems: [{ type: String, trim: true }],
  excludeDestinationFaqQuestions: [{ type: String, trim: true }],
  excludeDestinationHowItWorksTitles: [{ type: String, trim: true }],
  /** Hide specific global visa-requirement bullets on this country only. */
  excludeDestinationVisaRequirements: [{ type: String, trim: true }],
}, { timestamps: true });

module.exports = mongoose.model('Country', countrySchema);
