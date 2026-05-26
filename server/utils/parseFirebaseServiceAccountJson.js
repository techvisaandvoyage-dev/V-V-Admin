const fs = require('fs');
const path = require('path');

/**
 * Normalize JSON text pasted into .env / Render (BOM, outer quotes).
 */
const normalizeJsonInput = (raw) => {
  let s = String(raw ?? '').trim();
  if (!s) return '';
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1).trim();
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) {
    s = s.slice(1, -1).replace(/\\'/g, "'");
  }
  return s.trim();
};

const tryParseJson = (raw, lastError) => {
  try {
    return JSON.parse(raw);
  } catch (e) {
    lastError.message = e.message;
    return null;
  }
};

/**
 * Resolve service account object from env, optional DB string, or FIREBASE_SERVICE_ACCOUNT_PATH file.
 */
const loadServiceAccountSources = (sources = {}) => {
  const fromEnv = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  const fromDb = String(sources.rawFromDb || '').trim();
  let raw = normalizeJsonInput(fromEnv || sources.rawFromEnv || '');
  if (!raw && fromDb) raw = normalizeJsonInput(fromDb);

  let filePath = String(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim();
  if (!raw && !filePath) {
    const defaultPath = path.resolve(process.cwd(), 'firebase-key.json');
    const doubleExtPath = path.resolve(process.cwd(), 'firebase-key.json.json');
    if (fs.existsSync(defaultPath)) {
      filePath = defaultPath;
    } else if (fs.existsSync(doubleExtPath)) {
      filePath = doubleExtPath;
    }
  }

  if (!raw && filePath) {
    const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    try {
      if (fs.existsSync(abs)) {
        raw = normalizeJsonInput(fs.readFileSync(abs, 'utf8'));
      }
    } catch {
      /* ignore */
    }
  }

  if (!raw) return { parsed: null, rawUsed: '' };

  const lastError = { message: '' };
  let parsed = tryParseJson(raw, lastError);
  if (parsed) return { parsed, rawUsed: raw };

  try {
    const outer = JSON.parse(raw);
    if (typeof outer === 'string') {
      parsed = JSON.parse(outer);
      return { parsed, rawUsed: raw };
    }
  } catch {
    /* ignore */
  }

  const hint =
    'Use valid JSON. Easiest: download the key from Google Cloud, then either ' +
    '(1) set FIREBASE_SERVICE_ACCOUNT_PATH=./visa-key.json (path to the downloaded .json next to the server), or ' +
    '(2) put the entire JSON on ONE line in server/.env as FIREBASE_SERVICE_ACCOUNT_JSON={...}, or ' +
    '(3) in Render paste the full JSON into the environment variable (multi-line supported). ' +
    `Parse error: ${lastError.message || 'unknown'}`;
  throw new Error(`Firebase service account JSON is invalid. ${hint}`);
};

const normalizePrivateKeyNewlines = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const out = { ...obj };
  if (typeof out.private_key === 'string') {
    out.private_key = out.private_key.replace(/\\n/g, '\n');
  }
  return out;
};

module.exports = {
  loadServiceAccountSources,
  normalizePrivateKeyNewlines,
  normalizeJsonInput,
};
