const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

/**
 * Attaches req.user when a valid Bearer token is present; otherwise continues.
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer')) return next();
  const token = authHeader.split(' ')[1];
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const rawId = decoded.id ?? decoded.sub;
    const uid = rawId != null ? String(rawId) : '';
    if (uid && mongoose.Types.ObjectId.isValid(uid)) {
      req.user = { ...decoded, id: uid };
    }
  } catch {
    // ignore invalid token for public reads
  }
  return next();
};

module.exports = optionalAuth;
