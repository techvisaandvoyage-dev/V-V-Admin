const mongoose = require('mongoose');
const { travelerSnapshotSchemaDefinition } = require('../utils/travelerProfile');

const uploadedDocumentDetailSchema = new mongoose.Schema(
  {
    url: { type: String, default: '' },
    fileName: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    mimeType: { type: String, default: '' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  passportNo: { type: String, required: true },
  nationality: { type: String, required: true },
  dob: { type: Date, required: true },
  travelDate: { type: Date, required: true },
  returnDate: { type: Date },
  
  countryId: { type: String, required: true },
  countryName: { type: String, required: true },
  flagEmoji: { type: String, required: true },
  visaType: { type: String, required: true },
  fee: { type: Number, required: true },
  processingDays: { type: Number },
  applicationId: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
    trim: true,
  },
  transactionId: { type: String },
  paymentMethod: { type: String },
  paymentStatus: {
    type: String,
    enum: ['pending_payment', 'completed', 'cancelled', 'failed'],
    default: 'completed'
  },
  requiredDocuments: [{ type: String }],
  
  status: {
    type: String,
    enum: ['pending', 'review', 'approved', 'rejected'],
    default: 'pending'
  },
  
  documents: [{
    type: String // paths to the files in /uploads/documents
  }],

  travellerDocuments: [
    {
      travelerNo: { type: Number, required: true },
      travelerName: { type: String, default: "" },
      gdriveLink: { type: String, default: "" },
      /** Optional second folder (e.g. extra reference materials); not used for required-doc completion. */
      gdriveFurtherInfoLink: { type: String, default: "" },
      documents: { type: Map, of: String, default: {} },
      documentDetails: { type: Map, of: uploadedDocumentDetailSchema, default: {} },
      otherDocuments: [{ type: String }],
      uploadedAt: { type: Date, default: Date.now },
    },
  ],

  travelerNames: [{ type: String, default: "" }],

  travelerSelections: [
    {
      travelerNo: { type: Number, required: true },
      travelerProfileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TravelerProfile',
        default: null,
      },
      travelerSnapshot: {
        type: new mongoose.Schema(travelerSnapshotSchemaDefinition, { _id: false }),
        default: null,
      },
    },
  ],

  /** Headcount from checkout (service fee multiplier) */
  travellerCount: { type: Number, default: 1 },

  /** True when user paid from country page but still must fill passport / uploads */
  detailsPending: { type: Boolean, default: false },
  
  gdriveLink: { type: String, default: "" },
  /** Legacy single-traveler optional second Drive link (mirrors travellerDocuments[].gdriveFurtherInfoLink). */
  gdriveFurtherInfoLink: { type: String, default: "" },

  visaFilePath: { type: String, default: "" },
  visaFileName: { type: String, default: "" },
  visaFileUploadedAt: { type: Date, default: null },

  /** Internal / system messages (e.g. checkout draft). */
  notes: { type: String },
  /** Free-text message from the applicant (special requests, extra context). */
  applicantNotes: { type: String, default: '', maxlength: 8000 },
}, {
  timestamps: true
});

module.exports = mongoose.model('Application', applicationSchema);
