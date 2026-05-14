const mongoose = require('mongoose');

const commentLikeSchema = new mongoose.Schema(
  {
    comment: { type: mongoose.Schema.Types.ObjectId, ref: 'BlogComment', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

commentLikeSchema.index({ comment: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('CommentLike', commentLikeSchema);
