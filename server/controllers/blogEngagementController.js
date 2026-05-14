const mongoose = require('mongoose');
const BlogBookmark = require('../models/BlogBookmark');
const BlogPost = require('../models/BlogPost');
const BlogReport = require('../models/BlogReport');
const BlogComment = require('../models/BlogComment');
const BlogNotification = require('../models/BlogNotification');
const { findBlogBySlugOrId } = require('./blogPostController');

const listBookmarks = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      BlogBookmark.find({ user: req.visaUser._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'blog',
          match: { softDeleted: { $ne: true }, status: 'published' },
          select: 'title slug shortDescription thumbnail category likesCount commentsCount publishedAt',
          populate: { path: 'category', select: 'name slug' },
        })
        .lean(),
      BlogBookmark.countDocuments({ user: req.visaUser._id }),
    ]);
    const data = rows.map((r) => r.blog).filter(Boolean);
    res.json({
      success: true,
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const addBookmark = async (req, res) => {
  try {
    const { blogId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(blogId)) {
      return res.status(400).json({ success: false, message: 'Invalid blog id' });
    }
    const blog = await BlogPost.exists({
      _id: blogId,
      softDeleted: { $ne: true },
      status: 'published',
    });
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
    await BlogBookmark.updateOne(
      { user: req.visaUser._id, blog: blogId },
      { $setOnInsert: { user: req.visaUser._id, blog: blogId } },
      { upsert: true }
    );
    res.status(201).json({ success: true, message: 'Saved' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const removeBookmark = async (req, res) => {
  try {
    const { blogId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(blogId)) {
      return res.status(400).json({ success: false, message: 'Invalid blog id' });
    }
    await BlogBookmark.deleteOne({ user: req.visaUser._id, blog: blogId });
    res.json({ success: true, message: 'Removed' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const listNotifications = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      BlogNotification.find({ user: req.visaUser._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'blog', select: 'title slug' })
        .populate({ path: 'comment', select: 'content createdAt' })
        .lean(),
      BlogNotification.countDocuments({ user: req.visaUser._id }),
    ]);
    res.json({
      success: true,
      data: rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const markNotificationsRead = async (req, res) => {
  try {
    const { ids, all } = req.body || {};
    if (all) {
      await BlogNotification.updateMany({ user: req.visaUser._id }, { $set: { read: true } });
    } else if (Array.isArray(ids) && ids.length) {
      await BlogNotification.updateMany(
        { _id: { $in: ids }, user: req.visaUser._id },
        { $set: { read: true } }
      );
    } else {
      return res.status(400).json({ success: false, message: 'Provide ids[] or all: true' });
    }
    res.json({ success: true, message: 'Updated' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const shareMeta = async (req, res) => {
  try {
    const { slug } = req.params;
    const post = await findBlogBySlugOrId(slug, { status: 'published' });
    if (!post) return res.status(404).json({ success: false, message: 'Not found' });
    const base = process.env.PUBLIC_CLIENT_URL || '';
    const url = base ? `${base.replace(/\/$/, '')}/blog/${post.slug}` : `/blog/${post.slug}`;
    res.json({
      success: true,
      data: {
        title: post.seoTitle || post.title,
        description: post.seoDescription || post.shortDescription,
        image: post.thumbnail || post.bannerImage || '',
        url,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createReport = async (req, res) => {
  try {
    const { slug } = req.params;
    const { targetType, targetId, reason = '' } = req.body || {};
    if (!['comment', 'blog'].includes(targetType) || !mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ success: false, message: 'targetType and valid targetId required' });
    }
    const post = await findBlogBySlugOrId(slug, { status: 'published' });
    if (!post) return res.status(404).json({ success: false, message: 'Blog not found' });

    if (targetType === 'blog') {
      if (String(targetId) !== String(post._id)) {
        return res.status(400).json({ success: false, message: 'targetId must match this blog' });
      }
    } else {
      const c = await BlogComment.exists({
        _id: targetId,
        blog: post._id,
        softDeleted: { $ne: true },
      });
      if (!c) return res.status(400).json({ success: false, message: 'Comment not on this blog' });
    }

    await BlogReport.create({
      reporter: req.visaUser._id,
      targetType,
      targetId,
      reason: String(reason).slice(0, 2000),
    });
    res.status(201).json({ success: true, message: 'Report submitted' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  listBookmarks,
  addBookmark,
  removeBookmark,
  listNotifications,
  markNotificationsRead,
  shareMeta,
  createReport,
};
