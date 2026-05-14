const mongoose = require('mongoose');
const BlogComment = require('../models/BlogComment');
const BlogPost = require('../models/BlogPost');
const BlogNotification = require('../models/BlogNotification');
const { resolveMentionsFromContent } = require('../services/blog/mentionService');

const COMMENT_AUTHOR_SELECT = 'name username profileImage';

function serializeComment(c, likedSet) {
  const id = String(c._id);
  return {
    ...c,
    likedByMe: likedSet ? likedSet.has(id) : false,
  };
}

const getComments = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid blog id' });
    }
    const blog = await BlogPost.exists({
      _id: id,
      softDeleted: { $ne: true },
      status: 'published',
    });
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const skip = (page - 1) * limit;

    let parentFilter = null;
    if (req.query.parentComment && mongoose.Types.ObjectId.isValid(req.query.parentComment)) {
      parentFilter = req.query.parentComment;
    }

    const filter = {
      blog: id,
      softDeleted: { $ne: true },
      parentComment: parentFilter,
    };

    const [rows, total] = await Promise.all([
      BlogComment.find(filter)
        .sort({ pinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'user', select: COMMENT_AUTHOR_SELECT })
        .lean(),
      BlogComment.countDocuments(filter),
    ]);

    let likedSet = null;
    if (req.user?.role === 'user' && rows.length) {
      const User = require('../models/User');
      const u = await User.exists({ _id: req.user.id });
      if (u) {
        const CommentLike = require('../models/CommentLike');
        const ids = rows.map((r) => r._id);
        const likes = await CommentLike.find({
          user: req.user.id,
          comment: { $in: ids },
        })
          .select('comment')
          .lean();
        likedSet = new Set(likes.map((l) => String(l.comment)));
      }
    }

    res.json({
      success: true,
      data: rows.map((c) => serializeComment(c, likedSet)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createComment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid blog id' });
    }
    const { content, parentComment } = req.body;
    if (!content || !String(content).trim()) {
      return res.status(400).json({ success: false, message: 'Content is required' });
    }

    const blog = await BlogPost.findOne({
      _id: id,
      softDeleted: { $ne: true },
      status: 'published',
    });
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });

    let parent = null;
    if (parentComment && mongoose.Types.ObjectId.isValid(parentComment)) {
      parent = await BlogComment.findOne({
        _id: parentComment,
        blog: id,
        softDeleted: { $ne: true },
      });
      if (!parent) return res.status(400).json({ success: false, message: 'Invalid parent comment' });
    }

    const mentions = await resolveMentionsFromContent(content);

    const doc = await BlogComment.create({
      blog: id,
      user: req.visaUser._id,
      parentComment: parent ? parent._id : null,
      content: String(content).trim(),
      mentions,
    });

    await BlogPost.updateOne({ _id: id }, { $inc: { commentsCount: 1 } });
    if (parent) {
      await BlogComment.updateOne({ _id: parent._id }, { $inc: { repliesCount: 1 } });
      const parentAuthorId = String(parent.user);
      const replierId = String(req.visaUser._id);
      if (parentAuthorId !== replierId) {
        await BlogNotification.create({
          user: parent.user,
          type: 'comment_reply',
          blog: id,
          comment: doc._id,
          parentComment: parent._id,
        });
      }
    }

    const populated = await BlogComment.findById(doc._id)
      .populate({ path: 'user', select: COMMENT_AUTHOR_SELECT })
      .lean();
    res.status(201).json({ success: true, data: serializeComment(populated, new Set()) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const replyToComment = async (req, res) => {
  try {
    const parent = await BlogComment.findOne({
      _id: req.params.id,
      softDeleted: { $ne: true },
    });
    if (!parent) return res.status(404).json({ success: false, message: 'Parent comment not found' });
    req.body = { ...req.body, parentComment: parent._id };
    req.params.id = String(parent.blog);
    return createComment(req, res);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateComment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    const { content } = req.body;
    if (!content || !String(content).trim()) {
      return res.status(400).json({ success: false, message: 'Content is required' });
    }
    const c = await BlogComment.findOne({ _id: id, softDeleted: { $ne: true } });
    if (!c) return res.status(404).json({ success: false, message: 'Not found' });
    if (String(c.user) !== String(req.visaUser._id)) {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }
    c.content = String(content).trim();
    c.edited = true;
    c.mentions = await resolveMentionsFromContent(c.content);
    await c.save();
    const populated = await BlogComment.findById(c._id)
      .populate({ path: 'user', select: COMMENT_AUTHOR_SELECT })
      .lean();
    res.json({ success: true, data: populated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    const c = await BlogComment.findOne({ _id: id, softDeleted: { $ne: true } });
    if (!c) return res.status(404).json({ success: false, message: 'Not found' });
    if (String(c.user) !== String(req.visaUser._id)) {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }

    c.softDeleted = true;
    c.deletedAt = new Date();
    c.content = '[deleted]';
    await c.save();

    await BlogPost.updateOne({ _id: c.blog }, { $inc: { commentsCount: -1 } });
    if (c.parentComment) {
      await BlogComment.updateOne({ _id: c.parentComment }, { $inc: { repliesCount: -1 } });
    }

    res.json({ success: true, message: 'Deleted' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getComments,
  createComment,
  replyToComment,
  updateComment,
  deleteComment,
};
