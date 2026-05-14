const BlogPost = require('../../models/BlogPost');
const BlogCategory = require('../../models/BlogCategory');
const { slugify } = require('../../utils/slugify');

async function ensureUniquePostSlug(base, excludeId) {
  let slug = slugify(base);
  let n = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const q = { slug, softDeleted: { $ne: true } };
    if (excludeId) q._id = { $ne: excludeId };
    const exists = await BlogPost.exists(q);
    if (!exists) return slug;
    n += 1;
    slug = `${slugify(base)}-${n}`;
  }
}

async function ensureUniqueCategorySlug(base, excludeId) {
  let slug = slugify(base);
  let n = 0;
  while (true) {
    const q = { slug, softDeleted: { $ne: true } };
    if (excludeId) q._id = { $ne: excludeId };
    const exists = await BlogCategory.exists(q);
    if (!exists) return slug;
    n += 1;
    slug = `${slugify(base)}-${n}`;
  }
}

module.exports = { ensureUniquePostSlug, ensureUniqueCategorySlug, slugify };
