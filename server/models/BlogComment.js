const mongoose = require('mongoose');

const blogCommentSchema = new mongoose.Schema(
  {
    blog: { type: mongoose.Schema.Types.ObjectId, ref: 'BlogPost', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'BlogComment', default: null, index: true },
    content: { type: String, required: true, trim: true, maxlength: 8000 },
    /** Resolved User ids mentioned in content */
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    likesCount: { type: Number, default: 0 },
    repliesCount: { type: Number, default: 0 },
    edited: { type: Boolean, default: false },
    pinned: { type: Boolean, default: false },
    softDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

blogCommentSchema.index({ blog: 1, parentComment: 1, createdAt: -1 });
blogCommentSchema.index({ blog: 1, pinned: -1, createdAt: -1 });

module.exports = mongoose.model('BlogComment', blogCommentSchema);
