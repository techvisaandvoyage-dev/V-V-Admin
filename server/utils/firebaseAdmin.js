const admin = require('firebase-admin');
const Settings = require('../models/Settings');
const {
  loadServiceAccountSources,
  normalizePrivateKeyNewlines,
} = require('./parseFirebaseServiceAccountJson');

const FIREBASE_ADMIN_APP_NAME = 'visa-voyage-admin';
let firebaseAdminConfigSignature = '';

const normalizeStorageBucket = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  return raw
    .replace(/^gs:\/\//i, '')
    .replace(/^https?:\/\/storage\.googleapis\.com\//i, '')
    .replace(/^https?:\/\/firebasestorage\.googleapis\.com\/v0\/b\//i, '')
    .replace(/\/.*$/, '')
    .trim();
};

/**
 * Initialize and return the Firebase Admin app.
 * Re-initializes if the configuration (projectId, storageBucket, or service account) changes.
 */
const getFirebaseAdminApp = async () => {
  const settings = await Settings.findOne({ singleton: 'global' }).lean();
  const projectId = String(settings?.firebaseProjectId || process.env.FIREBASE_PROJECT_ID || '').trim();
  const storageBucket = normalizeStorageBucket(
    settings?.firebaseStorageBucket || process.env.FIREBASE_STORAGE_BUCKET || ''
  );
  
  const { parsed: parsedAccount, rawUsed } = loadServiceAccountSources({
    rawFromDb: settings?.firebaseServiceAccountJson,
  });
  
  const configSignature = `${projectId}:${storageBucket}:${rawUsed}`;
  const existingApp = admin.apps.find((app) => app.name === FIREBASE_ADMIN_APP_NAME);

  if (existingApp && firebaseAdminConfigSignature === configSignature) {
    return existingApp;
  }

  if (existingApp) {
    await existingApp.delete();
  }

  const config = {
    projectId: projectId || undefined,
    storageBucket: storageBucket || undefined,
  };

  if (parsedAccount && typeof parsedAccount === 'object') {
    const serviceAccount = normalizePrivateKeyNewlines(parsedAccount);
    config.credential = admin.credential.cert(serviceAccount);
    if (serviceAccount.project_id) config.projectId = serviceAccount.project_id;
  } else {
    config.credential = admin.credential.applicationDefault();
  }

  if (!config.projectId) {
    // If we're missing project ID, we can't initialize.
    // However, we'll try to let it fail during initializeApp if it's really needed.
  }

  firebaseAdminConfigSignature = configSignature;
  return admin.initializeApp(config, FIREBASE_ADMIN_APP_NAME);
};

module.exports = { getFirebaseAdminApp };
