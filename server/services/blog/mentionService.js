const User = require('../../models/User');

const HANDLE_RE = /@([a-z0-9_]{2,32})\b/gi;

/**
 * Extract @handles from text and resolve to User ids (by username).
 * @param {string} text
 */
async function resolveMentionsFromContent(text) {
  const content = String(text || '');
  const seen = new Set();
  const handles = [];
  let m;
  const re = new RegExp(HANDLE_RE.source, HANDLE_RE.flags);
  while ((m = re.exec(content)) !== null) {
    const h = String(m[1]).toLowerCase();
    if (!seen.has(h)) {
      seen.add(h);
      handles.push(h);
    }
  }
  if (!handles.length) return [];
  const users = await User.find({ username: { $in: handles } }).select('_id').lean();
  return users.map((u) => u._id);
}

module.exports = { resolveMentionsFromContent };
