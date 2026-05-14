const mongoose = require('mongoose');
const BlogLike = require('../models/BlogLike');
const BlogPost = require('../models/BlogPost');
const CommentLike = require('../models/CommentLike');
const BlogComment = require('../models/BlogComment');

const toggleBlogLike = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid blog id' });
    }
    const blog = await BlogPost.findOne({
      _id: id,
      softDeleted: { $ne: true },
      status: 'published',
    }).select('_id likesCount');
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });

    const existing = await BlogLike.findOneAndDelete({ blog: id, user: req.visaUser._id });
    if (existing) {
      await BlogPost.updateOne({ _id: id }, { $inc: { likesCount: -1 } });
      const updated = await BlogPost.findById(id).select('likesCount').lean();
      return res.json({
        success: true,
        liked: false,
        likesCount: Math.max(0, updated?.likesCount ?? 0),
      });
    }
    await BlogLike.create({ blog: id, user: req.visaUser._id });
    await BlogPost.updateOne({ _id: id }, { $inc: { likesCount: 1 } });
    const updated = await BlogPost.findById(id).select('likesCount').lean();
    res.json({ success: true, liked: true, likesCount: updated?.likesCount ?? 0 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const toggleCommentLike = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid comment id' });
    }
    const c = await BlogComment.findOne({ _id: id, softDeleted: { $ne: true } }).select('_id likesCount');
    if (!c) return res.status(404).json({ success: false, message: 'Comment not found' });

    const existing = await CommentLike.findOneAndDelete({ comment: id, user: req.visaUser._id });
    if (existing) {
      await BlogComment.updateOne({ _id: id }, { $inc: { likesCount: -1 } });
      const updated = await BlogComment.findById(id).select('likesCount').lean();
      return res.json({
        success: true,
        liked: false,
        likesCount: Math.max(0, updated?.likesCount ?? 0),
      });
    }
    await CommentLike.create({ comment: id, user: req.visaUser._id });
    await BlogComment.updateOne({ _id: id }, { $inc: { likesCount: 1 } });
    const updated = await BlogComment.findById(id).select('likesCount').lean();
    res.json({ success: true, liked: true, likesCount: updated?.likesCount ?? 0 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { toggleBlogLike, toggleCommentLike };
