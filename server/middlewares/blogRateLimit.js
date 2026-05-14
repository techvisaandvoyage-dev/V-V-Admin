const rateLimit = require('express-rate-limit');

const windowMs = 15 * 60 * 1000;

/** Stricter limit for creating comments */
const commentCreateLimiter = rateLimit({
  windowMs,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many comments, please try again later' },
});

const likeLimiter = rateLimit({
  windowMs,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many like actions, slow down' },
});

const blogReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests' },
});

const blogWriteLimiter = rateLimit({
  windowMs,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  commentCreateLimiter,
  likeLimiter,
  blogReadLimiter,
  blogWriteLimiter,
};
