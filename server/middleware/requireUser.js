const User = require('../models/User');

/**
 * Ensures JWT subject exists as a Visa app User (not an Admin token).
 * Sets req.visaUser with lean user doc { _id, name, username, profileImage }.
 */
const requireUser = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    if (req.user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'This action requires a signed-in visa user account',
      });
    }
    const user = await User.findById(req.user.id).select('name username profileImage email').lean();
    if (!user) {
      return res.status(403).json({ success: false, message: 'User account not found' });
    }
    req.visaUser = user;
    return next();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = requireUser;
