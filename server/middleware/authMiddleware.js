const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

/**
 * Middleware to protect routes via JWT
 * Sets req.user from decoded token (id is always a string ObjectId hex)
 */
const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer')) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }

  try {
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const rawId = decoded.id ?? decoded.sub;
    const uid = rawId != null ? String(rawId) : '';
    if (!uid || !mongoose.Types.ObjectId.isValid(uid)) {
      return res.status(401).json({ success: false, message: 'Not authorized, invalid token payload' });
    }

    req.user = { ...decoded, id: uid };
    return next();
  } catch (error) {
    if (error?.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Session expired. Please log in again.',
      });
    }
    console.error('protect middleware:', error);
    return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

module.exports = { protect, requireAdmin };
