const mongoose = require('mongoose');
const BlogPost = require('../models/BlogPost');
const BlogView = require('../models/BlogView');
const BlogCategory = require('../models/BlogCategory');
const { makeViewerKey } = require('../utils/viewerKey');
const { ensureUniquePostSlug } = require('../services/blog/slugService');

const PUBLIC_POPULATE = [
  { path: 'category', select: 'name slug order' },
  { path: 'attributedAuthor', select: 'name username profileImage' },
];

function normalizeSections(sections) {
  if (!Array.isArray(sections)) return [];
  return sections.map((s, i) => ({
    type: s.type,
    order: typeof s.order === 'number' ? s.order : i,
    payload: s.payload && typeof s.payload === 'object' ? s.payload : {},
  }));
}

async function findBlogBySlugOrId(param, extra = {}) {
  if (mongoose.Types.ObjectId.isValid(param) && String(param).length === 24) {
    const byId = await BlogPost.findOne({ _id: param, softDeleted: { $ne: true }, ...extra })
      .populate(PUBLIC_POPULATE)
      .lean();
    if (byId) return byId;
  }
  return BlogPost.findOne({
    slug: String(param).toLowerCase(),
    softDeleted: { $ne: true },
    ...extra,
  })
    .populate(PUBLIC_POPULATE)
    .lean();
}

const listBlogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 9));
    const skip = (page - 1) * limit;
    const filter = { softDeleted: { $ne: true }, status: 'published' };

    if (req.query.category) {
      const c = req.query.category;
      if (mongoose.Types.ObjectId.isValid(c)) {
        filter.category = c;
      } else {
        const cat = await BlogCategory.findOne({
          slug: String(c).toLowerCase(),
          softDeleted: { $ne: true },
        })
          .select('_id')
          .lean();
        if (cat) filter.category = cat._id;
        else filter.category = { $in: [] };
      }
    }

    if (req.query.tags) {
      const tags = String(req.query.tags)
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      if (tags.length) filter.tags = { $in: tags };
    }

    if (req.query.search) {
      filter.$text = { $search: String(req.query.search) };
    }

    let sort = { publishedAt: -1, createdAt: -1 };
    if (req.query.sort === 'likes') sort = { likesCount: -1, publishedAt: -1 };
    else if (req.query.sort === 'views' || req.query.sort === 'trending') {
      sort = { viewsCount: -1, publishedAt: -1 };
    } else if (req.query.sort === 'featured') sort = { featured: -1, publishedAt: -1 };

    const [items, total] = await Promise.all([
      BlogPost.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select(
          'title slug shortDescription thumbnail category tags likesCount commentsCount viewsCount publishedAt featured createdAt attributedAuthor'
        )
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

const getBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const post = await findBlogBySlugOrId(slug, { status: 'published' });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const ip = req.ip || req.connection?.remoteAddress || '';
    const userId = req.user?.role === 'user' ? req.user.id : null;
    const viewerKey = makeViewerKey(String(post._id), userId, ip);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await BlogView.exists({
      blog: post._id,
      viewerKey,
      viewedAt: { $gte: since },
    });
    if (!recent) {
      await Promise.all([
        BlogPost.updateOne({ _id: post._id }, { $inc: { viewsCount: 1 } }),
        BlogView.create({
          blog: post._id,
          user: userId || null,
          viewerKey,
        }),
      ]);
      post.viewsCount = (post.viewsCount || 0) + 1;
    }

    res.json({ success: true, data: post });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getRelated = async (req, res) => {
  try {
    const { slug } = req.params;
    const current = await findBlogBySlugOrId(slug, { status: 'published' });
    if (!current) return res.status(404).json({ success: false, message: 'Post not found' });
    const tagSet = (current.tags || []).slice(0, 6);
    const or = [{ category: current.category }];
    if (tagSet.length) or.push({ tags: { $in: tagSet } });
    const items = await BlogPost.find({
      softDeleted: { $ne: true },
      status: 'published',
      _id: { $ne: current._id },
      $or: or,
    })
      .sort({ featured: -1, publishedAt: -1 })
      .limit(6)
      .select('title slug shortDescription thumbnail category likesCount commentsCount publishedAt')
      .populate({ path: 'category', select: 'name slug' })
      .lean();
    res.json({ success: true, data: items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createBlog = async (req, res) => {
  try {
    const adminId = req.user.id;
    const {
      title,
      shortDescription = '',
      thumbnail = '',
      bannerImage = '',
      category,
      tags = [],
      sections = [],
      status = 'draft',
      featured = false,
      seoTitle = '',
      seoDescription = '',
      attributedAuthor = null,
      slug: slugInput,
    } = req.body;

    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });
    if (!category || !mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({ success: false, message: 'Valid category is required' });
    }

    const slug = await ensureUniquePostSlug(slugInput || title);
    const publishedAt = status === 'published' ? new Date() : null;

    const doc = await BlogPost.create({
      title: String(title).trim(),
      slug,
      shortDescription: String(shortDescription),
      thumbnail,
      bannerImage,
      category,
      tags: (tags || []).map((t) => String(t).toLowerCase().trim()).filter(Boolean),
      sections: normalizeSections(sections),
      attributedAuthor: attributedAuthor && mongoose.Types.ObjectId.isValid(attributedAuthor)
        ? attributedAuthor
        : null,
      createdByAdmin: adminId,
      status: status === 'published' ? 'published' : 'draft',
      featured: Boolean(featured),
      seoTitle: String(seoTitle || title).slice(0, 200),
      seoDescription: String(seoDescription || shortDescription).slice(0, 500),
      publishedAt,
    });

    const populated = await BlogPost.findById(doc._id).populate(PUBLIC_POPULATE).lean();
    res.status(201).json({ success: true, data: populated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid blog id' });
    }
    const post = await BlogPost.findOne({ _id: id, softDeleted: { $ne: true } });
    if (!post) return res.status(404).json({ success: false, message: 'Not found' });

    const body = req.body;
    if (body.title !== undefined) post.title = String(body.title).trim();
    if (body.shortDescription !== undefined) post.shortDescription = String(body.shortDescription);
    if (body.thumbnail !== undefined) post.thumbnail = String(body.thumbnail);
    if (body.bannerImage !== undefined) post.bannerImage = String(body.bannerImage);
    if (body.category !== undefined && mongoose.Types.ObjectId.isValid(body.category)) {
      post.category = body.category;
    }
    if (body.tags !== undefined) {
      post.tags = (body.tags || []).map((t) => String(t).toLowerCase().trim()).filter(Boolean);
    }
    if (body.sections !== undefined) post.sections = normalizeSections(body.sections);
    if (body.status !== undefined) {
      post.status = body.status === 'published' ? 'published' : 'draft';
      if (post.status === 'published' && !post.publishedAt) post.publishedAt = new Date();
    }
    if (body.featured !== undefined) post.featured = Boolean(body.featured);
    if (body.seoTitle !== undefined) post.seoTitle = String(body.seoTitle).slice(0, 200);
    if (body.seoDescription !== undefined) post.seoDescription = String(body.seoDescription).slice(0, 500);
    if (body.attributedAuthor !== undefined) {
      post.attributedAuthor =
        body.attributedAuthor && mongoose.Types.ObjectId.isValid(body.attributedAuthor)
          ? body.attributedAuthor
          : null;
    }

    if (body.slug != null) {
      post.slug = await ensureUniquePostSlug(body.slug, post._id);
    } else if (body.title && !req.body.keepSlug) {
      post.slug = await ensureUniquePostSlug(body.title, post._id);
    }

    await post.save();
    const populated = await BlogPost.findById(post._id).populate(PUBLIC_POPULATE).lean();
    res.json({ success: true, data: populated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid blog id' });
    }
    const post = await BlogPost.findOneAndUpdate(
      { _id: id, softDeleted: { $ne: true } },
      { softDeleted: true, deletedAt: new Date(), status: 'draft' },
      { new: true }
    );
    if (!post) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: post });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  listBlogs,
  getBlogBySlug,
  getRelated,
  createBlog,
  updateBlog,
  deleteBlog,
  findBlogBySlugOrId,
};
