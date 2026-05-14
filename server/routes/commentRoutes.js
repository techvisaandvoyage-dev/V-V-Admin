const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const requireUser = require('../middleware/requireUser');
const { commentCreateLimiter, likeLimiter } = require('../middlewares/blogRateLimit');
const cmtCtrl = require('../controllers/blogCommentController');
const likeCtrl = require('../controllers/blogLikeController');

router.post('/:id/reply', protect, requireUser, commentCreateLimiter, cmtCtrl.replyToComment);
router.put('/:id', protect, requireUser, cmtCtrl.updateComment);
router.delete('/:id', protect, requireUser, cmtCtrl.deleteComment);
router.post('/:id/like', protect, requireUser, likeLimiter, likeCtrl.toggleCommentLike);

module.exports = router;
