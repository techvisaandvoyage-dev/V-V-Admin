const mongoose = require('mongoose');

const blogViewSchema = new mongoose.Schema(
  {
    blog: { type: mongoose.Schema.Types.ObjectId, ref: 'BlogPost', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    /** sha256 of IP + salt from env for dedupe without storing raw IP */
    viewerKey: { type: String, required: true, index: true },
    viewedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

blogViewSchema.index({ blog: 1, viewerKey: 1, viewedAt: -1 });

module.exports = mongoose.model('BlogView', blogViewSchema);
