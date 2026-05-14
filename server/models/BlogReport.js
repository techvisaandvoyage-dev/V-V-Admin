const mongoose = require('mongoose');

const TARGET_TYPES = ['comment', 'blog'];

const REPORT_STATUS = ['open', 'reviewing', 'resolved', 'dismissed'];

const blogReportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: TARGET_TYPES, required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    reason: { type: String, trim: true, maxlength: 2000, default: '' },
    status: { type: String, enum: REPORT_STATUS, default: 'open' },
    moderatorNote: { type: String, trim: true, default: '' },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

blogReportSchema.index({ status: 1, createdAt: -1 });
blogReportSchema.index({ targetType: 1, targetId: 1 });

module.exports = mongoose.model('BlogReport', blogReportSchema);
