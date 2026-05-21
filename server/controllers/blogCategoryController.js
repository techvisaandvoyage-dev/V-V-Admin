const mongoose = require('mongoose');
const BlogCategory = require('../models/BlogCategory');
const BlogPost = require('../models/BlogPost');
const { ensureUniqueCategorySlug } = require('../services/blog/slugService');

const listCategoriesPublic = async (_req, res) => {
  try {
    const items = await BlogCategory.find({ softDeleted: { $ne: true }, isVisible: true })
      .sort({ order: 1, name: 1 })
      .lean();
    res.json({ success: true, data: items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const listCategoriesAdmin = async (_req, res) => {
  try {
    const items = await BlogCategory.find({ softDeleted: { $ne: true } })
      .sort({ order: 1, name: 1 })
      .lean();
    res.json({ success: true, data: items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, order = 0, isVisible = true, slug: slugIn } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    const slug = await ensureUniqueCategorySlug(slugIn || name);
    const doc = await BlogCategory.create({
      name: String(name).trim(),
      slug,
      order: Number(order) || 0,
      isVisible: Boolean(isVisible),
    });
    res.status(201).json({ success: true, data: doc });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    const cat = await BlogCategory.findOne({ _id: id, softDeleted: { $ne: true } });
    if (!cat) return res.status(404).json({ success: false, message: 'Not found' });
    const { name, order, isVisible, slug: slugIn } = req.body;
    if (name != null) cat.name = String(name).trim();
    if (order != null) cat.order = Number(order) || 0;
    if (isVisible != null) cat.isVisible = Boolean(isVisible);
    if (slugIn != null) {
      cat.slug = await ensureUniqueCategorySlug(slugIn, cat._id);
    }
    await cat.save();
    res.json({ success: true, data: cat });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    const count = await BlogPost.countDocuments({
      category: id,
      softDeleted: { $ne: true },
    });
    if (count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category while posts reference it. Reassign posts first.',
      });
    }
    const cat = await BlogCategory.findOneAndUpdate(
      { _id: id, softDeleted: { $ne: true } },
      { softDeleted: true, deletedAt: new Date(), isVisible: false },
      { returnDocument: 'after' }
    );
    if (!cat) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: cat });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const reorderCategories = async (req, res) => {
  try {
    const { categoryIds } = req.body;
    if (!Array.isArray(categoryIds) || !categoryIds.length) {
      return res.status(400).json({ success: false, message: 'categoryIds array required' });
    }
    const ops = categoryIds.map((cid, idx) =>
      BlogCategory.updateOne(
        { _id: cid, softDeleted: { $ne: true } },
        { $set: { order: idx } }
      )
    );
    await Promise.all(ops);
    const items = await BlogCategory.find({ softDeleted: { $ne: true } }).sort({ order: 1 }).lean();
    res.json({ success: true, data: items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  listCategoriesPublic,
  listCategoriesAdmin,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
};
