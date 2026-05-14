const mongoose = require('mongoose');
const { blogSectionSchema } = require('./BlogSection');

const STATUS = ['draft', 'published'];

const blogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    shortDescription: { type: String, default: '', trim: true },
    thumbnail: { type: String, default: '' },
    bannerImage: { type: String, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'BlogCategory', required: true },
    tags: [{ type: String, trim: true, lowercase: true }],
    sections: { type: [blogSectionSchema], default: [] },
    /** Visa app user shown as author when set; optional */
    attributedAuthor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    /** Admin who created/last owns the record */
    createdByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    status: { type: String, enum: STATUS, default: 'draft' },
    featured: { type: Boolean, default: false },
    viewsCount: { type: Number, default: 0 },
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    seoTitle: { type: String, default: '', trim: true },
    seoDescription: { type: String, default: '', trim: true },
    publishedAt: { type: Date, default: null },
    softDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

blogPostSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { softDeleted: { $ne: true } } }
);
blogPostSchema.index({ status: 1, featured: -1, publishedAt: -1 });
blogPostSchema.index({ category: 1, status: 1, publishedAt: -1 });
blogPostSchema.index({ tags: 1 });
blogPostSchema.index({ title: 'text', shortDescription: 'text', tags: 'text' });

module.exports = mongoose.model('BlogPost', blogPostSchema);
