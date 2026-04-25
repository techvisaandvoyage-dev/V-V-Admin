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
  paymentStatus: { type: String, default: 'completed' },
  
  status: {
    type: String,
    enum: ['pending', 'review', 'approved', 'rejected'],
    default: 'pending'
  },
  
  documents: [{
    type: String // paths to the files in /uploads/documents
  }],
  
  notes: { type: String }
}, {
  timestamps: true
});

module.exports = mongoose.model('Application', applicationSchema);
