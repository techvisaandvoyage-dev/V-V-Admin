const mongoose = require('mongoose');

const blogBookmarkSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    blog: { type: mongoose.Schema.Types.ObjectId, ref: 'BlogPost', required: true },
  },
  { timestamps: true }
);

blogBookmarkSchema.index({ user: 1, blog: 1 }, { unique: true });

module.exports = mongoose.model('BlogBookmark', blogBookmarkSchema);
