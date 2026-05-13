const mongoose = require('mongoose');

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
      documents: { type: Map, of: String, default: {} },
      otherDocuments: [{ type: String }],
      uploadedAt: { type: Date, default: Date.now },
    },
  ],

  travelerNames: [{ type: String, default: "" }],

  /** Headcount from checkout (service fee multiplier) */
  travellerCount: { type: Number, default: 1 },

  /** True when user paid from country page but still must fill passport / uploads */
  detailsPending: { type: Boolean, default: false },
  
  gdriveLink: { type: String, default: "" },

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
