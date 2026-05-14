const mongoose = require('mongoose');
const BlogPost = require('../models/BlogPost');
const BlogComment = require('../models/BlogComment');
const BlogReport = require('../models/BlogReport');

const listAdminBlogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const filter = { softDeleted: { $ne: true } };
    if (req.query.status === 'draft' || req.query.status === 'published') {
      filter.status = req.query.status;
    }
    if (req.query.search) {
      filter.$text = { $search: String(req.query.search) };
    }
    const [items, total] = await Promise.all([
      BlogPost.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'category', select: 'name slug' })
        .populate({ path: 'attributedAuthor', select: 'name username profileImage' })
        .lean(),
      BlogPost.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const listAdminComments = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const skip = (page - 1) * limit;
    const filter = { softDeleted: { $ne: true } };
    if (req.query.blog && mongoose.Types.ObjectId.isValid(req.query.blog)) {
      filter.blog = req.query.blog;
    }
    const [items, total] = await Promise.all([
      BlogComment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'user', select: 'name email username' })
        .populate({ path: 'blog', select: 'title slug status' })
        .lean(),
      BlogComment.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const adminDeleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    const c = await BlogComment.findOne({ _id: id, softDeleted: { $ne: true } });
    if (!c) return res.status(404).json({ success: false, message: 'Not found' });
    c.softDeleted = true;
    c.deletedAt = new Date();
    c.content = '[removed by moderator]';
    await c.save();
    await BlogPost.updateOne({ _id: c.blog }, { $inc: { commentsCount: -1 } });
    if (c.parentComment) {
      await BlogComment.updateOne({ _id: c.parentComment }, { $inc: { repliesCount: -1 } });
    }
    res.json({ success: true, message: 'Removed' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const toggleFeatureBlog = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    const featured =
      req.body && Object.prototype.hasOwnProperty.call(req.body, 'featured')
        ? Boolean(req.body.featured)
        : undefined;
    const post = await BlogPost.findOne({ _id: id, softDeleted: { $ne: true } });
    if (!post) return res.status(404).json({ success: false, message: 'Not found' });
    if (featured === undefined) post.featured = !post.featured;
    else post.featured = featured;
    await post.save();
    res.json({ success: true, data: { id: post._id, featured: post.featured } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const togglePinComment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    const c = await BlogComment.findOne({ _id: id, softDeleted: { $ne: true } });
    if (!c) return res.status(404).json({ success: false, message: 'Not found' });
    if (c.parentComment) {
      return res.status(400).json({ success: false, message: 'Only top-level comments can be pinned' });
    }
    if (typeof req.body?.pinned === 'boolean') c.pinned = req.body.pinned;
    else c.pinned = !c.pinned;
    await c.save();
    res.json({ success: true, data: { id: c._id, pinned: c.pinned } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const listReports = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const skip = (page - 1) * limit;
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([
      BlogReport.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'reporter', select: 'name email username' })
        .lean(),
      BlogReport.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const REPORT_STATUS = ['open', 'reviewing', 'resolved', 'dismissed'];

const updateReport = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    const { status, moderatorNote } = req.body || {};
    const rep = await BlogReport.findById(id);
    if (!rep) return res.status(404).json({ success: false, message: 'Not found' });
    if (status != null) {
      if (!REPORT_STATUS.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }
      rep.status = status;
    }
    if (moderatorNote != null) rep.moderatorNote = String(moderatorNote);
    if (status === 'resolved' || status === 'dismissed') rep.resolvedAt = new Date();
    await rep.save();
    res.json({ success: true, data: rep });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  listAdminBlogs,
  listAdminComments,
  adminDeleteComment,
  toggleFeatureBlog,
  togglePinComment,
  listReports,
  updateReport,
};
