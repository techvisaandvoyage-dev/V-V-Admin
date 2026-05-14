const crypto = require('crypto');

function getViewSalt() {
  return process.env.VIEW_TRACKING_SALT || process.env.JWT_SECRET || 'visa-blog-views';
}

/**
 * Stable pseudonymous key per blog + viewer for deduping impressions.
 * @param {string} blogIdHex
 * @param {string | null} userIdHex
 * @param {string} ip
 */
function makeViewerKey(blogIdHex, userIdHex, ip) {
  const raw = `${getViewSalt()}|${blogIdHex}|${userIdHex || 'anon'}|${ip || '0'}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

module.exports = { makeViewerKey };
