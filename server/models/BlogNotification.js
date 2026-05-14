const mongoose = require('mongoose');

const TYPES = ['comment_reply'];

const blogNotificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: TYPES, required: true },
    blog: { type: mongoose.Schema.Types.ObjectId, ref: 'BlogPost', required: true },
    /** The new reply comment */
    comment: { type: mongoose.Schema.Types.ObjectId, ref: 'BlogComment', required: true },
    /** Parent comment that was replied to (owned by `user`) */
    parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'BlogComment', default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

blogNotificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('BlogNotification', blogNotificationSchema);
