const mongoose = require('mongoose');

const blogCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    /** Display order in navbar (lower first) */
    order: { type: Number, default: 0 },
    isVisible: { type: Boolean, default: true },
    softDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

blogCategorySchema.index({ order: 1, name: 1 });
blogCategorySchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { softDeleted: { $ne: true } } }
);

module.exports = mongoose.model('BlogCategory', blogCategorySchema);
