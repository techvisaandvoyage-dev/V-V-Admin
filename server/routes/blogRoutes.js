const express = require('express');
const router = express.Router();
const { protect, requireAdmin } = require('../middleware/authMiddleware');
const optionalAuth = require('../middleware/optionalAuth');
const requireUser = require('../middleware/requireUser');
const {
  commentCreateLimiter,
  likeLimiter,
  blogReadLimiter,
  blogWriteLimiter,
} = require('../middlewares/blogRateLimit');

const catCtrl = require('../controllers/blogCategoryController');
const postCtrl = require('../controllers/blogPostController');
const cmtCtrl = require('../controllers/blogCommentController');
const likeCtrl = require('../controllers/blogLikeController');
const extra = require('../controllers/blogEngagementController');

router.get('/categories', blogReadLimiter, catCtrl.listCategoriesPublic);
router.post('/categories', protect, requireAdmin, blogWriteLimiter, catCtrl.createCategory);
router.put('/categories/:id', protect, requireAdmin, blogWriteLimiter, catCtrl.updateCategory);
router.delete('/categories/:id', protect, requireAdmin, blogWriteLimiter, catCtrl.deleteCategory);
router.patch(
  '/categories/reorder',
  protect,
  requireAdmin,
  blogWriteLimiter,
  catCtrl.reorderCategories
);

router.get('/me/bookmarks', protect, requireUser, extra.listBookmarks);
router.post('/me/bookmarks/:blogId', protect, requireUser, likeLimiter, extra.addBookmark);
router.delete('/me/bookmarks/:blogId', protect, requireUser, extra.removeBookmark);

router.get('/me/notifications', protect, requireUser, extra.listNotifications);
router.patch('/me/notifications/read', protect, requireUser, extra.markNotificationsRead);

router.get('/', blogReadLimiter, postCtrl.listBlogs);
router.post('/', protect, requireAdmin, blogWriteLimiter, postCtrl.createBlog);

router.get('/:slug/related', blogReadLimiter, postCtrl.getRelated);
router.get('/:slug/share', blogReadLimiter, extra.shareMeta);
router.post('/:slug/report', protect, requireUser, commentCreateLimiter, extra.createReport);

router.post('/:id/like', protect, requireUser, likeLimiter, likeCtrl.toggleBlogLike);
router.get('/:id/comments', optionalAuth, blogReadLimiter, cmtCtrl.getComments);
router.post('/:id/comments', protect, requireUser, commentCreateLimiter, cmtCtrl.createComment);

router.put('/:id', protect, requireAdmin, blogWriteLimiter, postCtrl.updateBlog);
router.delete('/:id', protect, requireAdmin, blogWriteLimiter, postCtrl.deleteBlog);

router.get('/:slug', optionalAuth, blogReadLimiter, postCtrl.getBlogBySlug);

module.exports = router;
