const User = require('../models/User');
const Otp = require('../models/Otp');
const Settings = require('../models/Settings');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');
const { sendLoginOtpSms } = require('../services/smsService');
const { OAuth2Client } = require('google-auth-library');
const admin = require('firebase-admin');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const {
  loadServiceAccountSources,
  normalizePrivateKeyNewlines,
} = require('../utils/parseFirebaseServiceAccountJson');
const FIREBASE_ADMIN_APP_NAME = 'visa-voyage-auth';
let firebaseAdminConfigSignature = '';

const generateToken = (id) => {
  return jwt.sign({ id: String(id), role: 'user' }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};

/** Phone OTP is enabled unless ENABLE_PHONE_LOGIN_OTP=false in env. */
const isPhoneLoginOtpEnabled = () => process.env.ENABLE_PHONE_LOGIN_OTP !== 'false';

const EMAIL_OTP_CONFIG_HINT =
  'Could not send email. Configure SMTP in Admin → Settings, or set EMAIL_USER and EMAIL_PASS in server/.env (see server/.env.example).';

const getFirebaseAdminApp = async () => {
  const settings = await Settings.findOne({ singleton: 'global' }).lean();
  const projectId = String(settings?.firebaseProjectId || process.env.FIREBASE_PROJECT_ID || '').trim();
  const { parsed: parsedAccount, rawUsed } = loadServiceAccountSources({
    rawFromDb: settings?.firebaseServiceAccountJson,
  });
  const configSignature = `${projectId}:${rawUsed}`;
  const existingApp = admin.apps.find((app) => app.name === FIREBASE_ADMIN_APP_NAME);

  if (existingApp && firebaseAdminConfigSignature === configSignature) {
    return existingApp;
  }

  if (existingApp) {
    await existingApp.delete();
  }

  if (parsedAccount && typeof parsedAccount === 'object') {
    const serviceAccount = normalizePrivateKeyNewlines(parsedAccount);

    firebaseAdminConfigSignature = configSignature;
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || projectId,
    }, FIREBASE_ADMIN_APP_NAME);
  }

  if (!projectId) {
    throw new Error('Firebase project ID is not configured');
  }

  firebaseAdminConfigSignature = configSignature;
  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
  }, FIREBASE_ADMIN_APP_NAME);
};

const normalizeFirebaseName = (decodedToken) =>
  String(decodedToken.name || decodedToken.email?.split('@')[0] || 'Google User').trim();

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/** Login OTP only — supports 4 (e.g. quick apply flow) or 6 (default). */
const generateLoginOtp = (length = 6) => {
  if (length === 4) {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

/** Last 10 digits for India mobile; used for DB storage and OTP lookup */
const normalizePhoneDigits = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return null;
};

/** Normalize login identifier — same @-first rule as signup (see parseSignupIdentifier). */
const normalizeLoginIdentifier = (rawId) => {
  const trimmed = String(rawId || '').trim();
  if (!trimmed) return { type: 'invalid', key: null };
  if (trimmed.includes('@')) {
    const lower = trimmed.toLowerCase();
    if (!isValidEmail(lower)) return { type: 'invalid', key: null };
    return { type: 'email', key: lower };
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10) return { type: 'invalid', key: null };
  const phoneKey = digits.slice(-10);
  return { type: 'phone', key: phoneKey };
};

const findUserForLoginOtp = async (type, key) => {
  if (type === 'email') {
    return User.findOne({ email: key });
  }
  return User.findOne({
    $or: [
      { phone: key },
      { phone: `91${key}` },
      { phone: `+91${key}` },
    ],
  });
};

const findUserByPhoneKey = (phoneKey) =>
  User.findOne({
    $or: [
      { phone: phoneKey },
      { phone: `91${phoneKey}` },
      { phone: `+91${phoneKey}` },
    ],
  });

/** @returns {{ kind: 'email', key: string, email: string } | { kind: 'phone', key: string, phoneKey: string } | { kind: 'invalid' }} */
const parseSignupIdentifier = (rawId) => {
  const trimmed = String(rawId || '').trim();
  if (!trimmed) return { kind: 'invalid' };
  // Match client RegisterPage: @ present → email only (never treat as phone).
  if (trimmed.includes('@')) {
    const asEmail = trimmed.toLowerCase();
    if (!isValidEmail(asEmail)) return { kind: 'invalid' };
    return { kind: 'email', key: asEmail, email: asEmail };
  }
  const phoneKey = normalizePhoneDigits(trimmed);
  if (phoneKey && /^\d{10}$/.test(phoneKey)) {
    return { kind: 'phone', key: phoneKey, phoneKey };
  }
  return { kind: 'invalid' };
};

/**
 * @route   POST /api/users/signup
 * @desc    Register a new user and send OTP
 * @access  Public
 */
const signupUser = async (req, res) => {
  try {
    const { name: rawName, identifier: rawId, password } = req.body;
    const name = String(rawName || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    const parsed = parseSignupIdentifier(rawId);
    if (parsed.kind === 'invalid') {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address or a 10-digit mobile number',
      });
    }

    if (parsed.kind === 'email') {
      const { key: identifier, email } = parsed;
      const userExists = await User.findOne({ email });

      if (userExists) {
        if (!userExists.isVerified) {
          await Otp.deleteMany({ identifier, purpose: 'signup' });
          const otp = generateOTP();
          await Otp.create({ identifier, otp, purpose: 'signup' });
          const resent = await sendEmail({
            email,
            subject: 'Visa & Voyage - Verify your account',
            html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0d1117; border-radius: 16px; border: 1px solid #21262d;">
              <h2 style="color: #06b6d4; margin-bottom: 8px;">Welcome to Visa & Voyage!</h2>
              <p style="color: #8b949e; margin-bottom: 24px;">Here's a new verification code for your account:</p>
              <div style="background: #161b22; border: 2px solid #06b6d4; border-radius: 12px; padding: 24px; text-align: center; letter-spacing: 0.5em; font-size: 32px; font-weight: bold; color: #f0f6fc; font-family: monospace;">${otp}</div>
              <p style="color: #8b949e; font-size: 13px; margin-top: 20px;">This code expires in 10 minutes. Do not share it with anyone.</p>
            </div>
          `,
          });
          if (!resent) {
            await Otp.deleteMany({ identifier, purpose: 'signup' });
            return res.status(503).json({
              success: false,
              message: EMAIL_OTP_CONFIG_HINT,
            });
          }
          return res.status(201).json({ success: true, message: 'OTP resent. Please verify your account.' });
        }
        return res.status(400).json({ success: false, message: 'An account with this email already exists' });
      }

      const user = await User.create({
        name,
        email,
        password,
      });

      await Otp.deleteMany({ identifier, purpose: 'signup' });
      const otp = generateOTP();
      await Otp.create({ identifier, otp, purpose: 'signup' });

      const signupSent = await sendEmail({
        email,
        subject: 'Visa & Voyage - Verify your account',
        html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0d1117; border-radius: 16px; border: 1px solid #21262d;">
          <h2 style="color: #06b6d4; margin-bottom: 8px;">Welcome to Visa & Voyage!</h2>
          <p style="color: #8b949e; margin-bottom: 24px;">Enter the code below to verify your account:</p>
          <div style="background: #161b22; border: 2px solid #06b6d4; border-radius: 12px; padding: 24px; text-align: center; letter-spacing: 0.5em; font-size: 32px; font-weight: bold; color: #f0f6fc; font-family: monospace;">${otp}</div>
          <p style="color: #8b949e; font-size: 13px; margin-top: 20px;">This code expires in 10 minutes. Do not share it with anyone.</p>
        </div>
      `,
      });

      if (!signupSent) {
        await Otp.deleteMany({ identifier, purpose: 'signup' });
        await User.findByIdAndDelete(user._id);
        return res.status(503).json({
          success: false,
          message: EMAIL_OTP_CONFIG_HINT,
        });
      }

      return res.status(201).json({ success: true, message: 'OTP sent successfully. Please verify.' });
    }

    /* phone signup */
    const { key: identifier, phoneKey } = parsed;
    const userExists = await findUserByPhoneKey(phoneKey);

    if (userExists) {
      if (!userExists.isVerified) {
        await Otp.deleteMany({ identifier, purpose: 'signup' });
        const otp = generateOTP();
        await Otp.create({ identifier, otp, purpose: 'signup' });
        const smsResult = await sendLoginOtpSms(phoneKey, otp);
        if (smsResult.sent) {
          return res.status(201).json({ success: true, message: 'OTP resent. Please verify your account.' });
        }
        if (smsResult.skipped) {
          const payload = {
            success: true,
            message:
              'OTP ready — SMS not configured; check the server terminal or use the test code if your app shows one.',
          };
          if (
            process.env.NODE_ENV !== 'production' ||
            process.env.LOGIN_OTP_DEV_REVEAL === 'true'
          ) {
            payload.devOtp = otp;
          }
          return res.status(201).json(payload);
        }
        await Otp.deleteMany({ identifier, purpose: 'signup' });
        return res.status(502).json({
          success: false,
          message: 'Could not send SMS. Configure SMS91 in Admin settings or .env and try again.',
        });
      }
      return res.status(400).json({ success: false, message: 'An account with this phone number already exists' });
    }

    const user = await User.create({
      name,
      phone: phoneKey,
      password,
    });

    await Otp.deleteMany({ identifier, purpose: 'signup' });
    const otp = generateOTP();
    await Otp.create({ identifier, otp, purpose: 'signup' });

    const smsResult = await sendLoginOtpSms(phoneKey, otp);
    if (smsResult.sent) {
      return res.status(201).json({ success: true, message: 'OTP sent to your phone. Please verify.' });
    }
    if (smsResult.skipped) {
      const payload = {
        success: true,
        message:
          'Account created — SMS not configured; OTP is valid. Check the server log or use the test code if shown.',
      };
      if (
        process.env.NODE_ENV !== 'production' ||
        process.env.LOGIN_OTP_DEV_REVEAL === 'true'
      ) {
        payload.devOtp = otp;
      }
      return res.status(201).json(payload);
    }

    await Otp.deleteMany({ identifier, purpose: 'signup' });
    await User.findByIdAndDelete(user._id);
    return res.status(502).json({
      success: false,
      message: 'Could not send SMS. Configure SMS91 in Admin settings or .env.',
    });
  } catch (error) {
    console.error(error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @route   POST /api/users/verify-otp
 * @desc    Verify OTP to activate account
 * @access  Public
 */
const verifyOtp = async (req, res) => {
  try {
    const { identifier: rawId, otp } = req.body;
    const parsed = parseSignupIdentifier(rawId);
    if (parsed.kind === 'invalid') {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address or a 10-digit mobile number',
      });
    }

    const identifier = parsed.key;
    const otpRecord = await Otp.findOne({ identifier, otp: String(otp), purpose: 'signup' });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const user =
      parsed.kind === 'email'
        ? await User.findOne({ email: parsed.email })
        : await findUserByPhoneKey(parsed.phoneKey);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isVerified = true;
    await user.save();
    await Otp.deleteOne({ _id: otpRecord._id });

    res.json({
      success: true,
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @route   POST /api/users/send-login-otp
 * @desc    Send OTP for passwordless login
 */
const sendLoginOtp = async (req, res) => {
  try {
    const { identifier: rawId, otpLength: rawLen } = req.body;
    let otpLength = parseInt(rawLen, 10);
    if (![4, 6].includes(otpLength)) otpLength = 6;

    const { type, key } = normalizeLoginIdentifier(rawId);

    if (type === 'invalid' || !key) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address or a 10-digit mobile number',
      });
    }

    if (type === 'phone' && !isPhoneLoginOtpEnabled()) {
      return res.status(403).json({
        success: false,
        message: 'Phone OTP is disabled. Log in with email OTP or password.',
      });
    }

    const user = await findUserForLoginOtp(type, key);
    if (!user) {
      const msg =
        type === 'phone'
          ? 'No account found for this phone number. Use the number on your profile, or sign up first.'
          : 'No account found for this email. Sign up or use your registered email.';
      return res.status(404).json({ success: false, message: msg });
    }

    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: 'Account not verified. Please complete signup first.' });
    }

    await Otp.deleteMany({ identifier: key, purpose: 'login' });

    const otp = generateLoginOtp(otpLength);
    await Otp.create({ identifier: key, otp, purpose: 'login' });

    // Always print OTP to the server terminal (set SUPPRESS_LOGIN_OTP_LOG=true to disable).
    if (process.env.SUPPRESS_LOGIN_OTP_LOG !== 'true') {
      console.log(
        `\n========== [Login OTP] COPY THIS CODE ==========\n  OTP: ${otp}  (${otpLength} digits)\n  Channel: ${type}  |  Identifier: ${key}\n==================================================\n`
      );
    }

    let smsResult = null;
    if (type === 'email') {
      const loginEmailSent = await sendEmail({
        email: key,
        subject: 'Visa & Voyage - Login OTP',
        html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0d1117; border-radius: 16px; border: 1px solid #21262d;">
          <h2 style="color: #06b6d4; margin-bottom: 8px;">Your Visa & Voyage Login Code</h2>
          <p style="color: #8b949e; margin-bottom: 24px;">Use the code below to log in to your Visa & Voyage account:</p>
          <div style="background: #161b22; border: 2px solid #06b6d4; border-radius: 12px; padding: 24px; text-align: center; letter-spacing: 0.5em; font-size: 32px; font-weight: bold; color: #f0f6fc; font-family: monospace;">${otp}</div>
          <p style="color: #8b949e; font-size: 13px; margin-top: 20px;">This ${otpLength}-digit code expires in 10 minutes. Do not share it with anyone.</p>
        </div>
      `
      });
      if (!loginEmailSent) {
        await Otp.deleteMany({ identifier: key, purpose: 'login' });
        return res.status(503).json({
          success: false,
          message: EMAIL_OTP_CONFIG_HINT,
        });
      }
    } else {
      smsResult = await sendLoginOtpSms(key, otp);
      if (smsResult.sent) {
        // delivered via SMS91
      } else if (smsResult.skipped) {
        // No SMS gateway: OTP is still valid (DB + server log). Do not block phone login.
      } else {
        return res.status(502).json({
          success: false,
          message: 'Could not send SMS. Please try again in a few minutes.',
        });
      }
    }

    const payload = {
      success: true,
      message:
        type === 'email'
          ? 'OTP sent to your email'
          : smsResult?.skipped
            ? 'OTP ready — SMS not configured; check server terminal or use the code shown in the app if provided.'
            : 'OTP sent to your registered number',
    };
    /** devOtp when: non-production, explicit flag, or phone login with SMS skipped (no gateway). */
    const revealLoginOtp =
      process.env.NODE_ENV !== 'production' ||
      process.env.LOGIN_OTP_DEV_REVEAL === 'true' ||
      (type === 'phone' && smsResult?.skipped);
    if (revealLoginOtp) {
      payload.devOtp = otp;
    }
    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @route   POST /api/users/verify-login-otp
 * @desc    Verify OTP for passwordless login (existing users only)
 * @access  Public
 */
const verifyLoginOtp = async (req, res) => {
  try {
    const { identifier: rawId, otp } = req.body;
    const { type, key } = normalizeLoginIdentifier(rawId);

    if (type === 'invalid' || !key) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address or a 10-digit mobile number',
      });
    }

    if (type === 'phone' && !isPhoneLoginOtpEnabled()) {
      return res.status(403).json({
        success: false,
        message: 'Phone OTP is disabled.',
      });
    }

    const otpRecord = await Otp.findOne({ identifier: key, otp, purpose: 'login' });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const user = await findUserForLoginOtp(type, key);
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this identifier' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: 'Account not verified. Please sign up again.' });
    }

    await Otp.deleteOne({ _id: otpRecord._id });

    if (type === 'phone' && key && /^\d{10}$/.test(String(key))) {
      user.phone = String(key);
      await user.save();
    }

    const safe = await User.findById(user._id).select('-password').lean();

    res.json({
      success: true,
      token: generateToken(user._id),
      user: {
        id: safe._id,
        name: safe.name,
        email: safe.email,
        phone: safe.phone,
        isVerified: safe.isVerified
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * Create or update app user from a verified Firebase Auth ID token (Google, Email/Password, etc.).
 */
const syncUserFromFirebaseToken = async (decodedToken) => {
  const uid = String(decodedToken.uid || '').trim();
  const email = String(decodedToken.email || '').trim().toLowerCase();
  const signInProvider = String(decodedToken.firebase?.sign_in_provider || '');
  const isGoogle = signInProvider === 'google.com';
  const isFacebook = signInProvider === 'facebook.com';

  if (!uid || !isValidEmail(email)) {
    const err = new Error('Firebase account must include a valid email address');
    err.statusCode = 400;
    throw err;
  }

  const emailVerified = Boolean(decodedToken.email_verified);
  const isVerified = emailVerified || isGoogle || isFacebook;

  let user = await User.findOne({
    $or: [{ email }, { firebaseUid: uid }, { googleId: uid }, { facebookId: uid }],
  });

  const phoneDigits = normalizePhoneDigits(decodedToken.phone_number);

  if (!user) {
    user = await User.create({
      name: normalizeFirebaseName(decodedToken),
      email,
      firebaseUid: uid,
      ...(isGoogle ? { googleId: uid } : {}),
      ...(isFacebook ? { facebookId: uid } : {}),
      profileImage:
        isGoogle || isFacebook ? String(decodedToken.picture || '').trim() : '',
      isVerified,
      ...(phoneDigits ? { phone: phoneDigits } : {}),
    });
    return user;
  }

  user.firebaseUid = uid;
  if (isGoogle) {
    user.googleId = uid;
    if (!user.profileImage && decodedToken.picture) {
      user.profileImage = String(decodedToken.picture || '').trim();
    }
  }
  if (isFacebook) {
    user.facebookId = uid;
    if (!user.profileImage && decodedToken.picture) {
      user.profileImage = String(decodedToken.picture || '').trim();
    }
  }
  if (isVerified) user.isVerified = true;
  if (!user.name) user.name = normalizeFirebaseName(decodedToken);
  if (phoneDigits) user.phone = phoneDigits;
  await user.save();
  return user;
};

/**
 * @route   POST /api/users/firebase-auth
 * @route   POST /api/users/firebase-google (alias)
 * @desc    Log in or create account using any Firebase ID token (Google, Email/Password, …)
 * @access  Public
 */
const firebaseAuthLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Firebase ID token is required' });
    }

    const firebaseApp = await getFirebaseAdminApp();
    const decodedToken = await firebaseApp.auth().verifyIdToken(idToken);
    const user = await syncUserFromFirebaseToken(decodedToken);

    const refreshed = await User.findById(user._id).select('-password').lean();

    res.json({
      success: true,
      token: generateToken(user._id),
      user: {
        id: refreshed._id,
        name: refreshed.name,
        email: refreshed.email,
        phone: refreshed.phone,
        profileImage: refreshed.profileImage,
        isVerified: refreshed.isVerified
      }
    });
  } catch (error) {
    console.error('[Firebase Auth]', error);
    const msg = String(error.message || '');
    const notConfigured =
      msg.includes('not configured') ||
      msg.includes('service account') ||
      msg.includes('Firebase project ID') ||
      msg.includes('invalid') && msg.includes('JSON');
    const status = error.statusCode === 400 ? 400 : notConfigured ? 503 : 401;
    const message =
      error.statusCode === 400
        ? error.message
        : notConfigured
          ? msg ||
            'Firebase Admin is not configured. Paste the service account JSON in Admin → Settings → Firebase, and ensure the project matches your web app.'
          : msg.includes('Firebase') || msg.includes('auth/')
            ? msg
            : 'Firebase log-in failed. Check that the ID token is valid and Admin settings match your Firebase project.';
    res.status(status).json({ success: false, message });
  }
};

/** @deprecated Use firebaseAuthLogin; kept for older clients */
const firebaseGoogleLogin = firebaseAuthLogin;

/**
 * @route   POST /api/users/login
 * @desc    Standard Password login
 */
const loginUser = async (req, res) => {
  try {
    const { identifier: rawId, password } = req.body;
    const trimmed = String(rawId || '').trim();
    const lower = trimmed.toLowerCase();

    let user;
    if (isValidEmail(lower)) {
      user = await User.findOne({ email: lower });
    } else {
      const phoneKey = normalizePhoneDigits(trimmed);
      if (!phoneKey || !/^\d{10}$/.test(phoneKey)) {
        return res.status(400).json({
          success: false,
          message: 'Please login with your registered email or 10-digit mobile number',
        });
      }
      user = await findUserByPhoneKey(phoneKey);
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: 'This account uses Firebase or OTP log-in. Use those options on the login page.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: 'Account not verified. Please request OTP.' });
    }

    res.json({
      success: true,
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Forgot Password and Reset remain similar but use identifier...
// For brevity, skipping them or keeping them email-focused unless requested

/**
 * @route   GET /api/users/profile
 * @desc    Get user profile data
 * @access  Private
 */
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @route   PUT /api/users/profile/update
 * @desc    Update user profile data
 * @access  Private
 */
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Extract allowed fields
    const { name, age, gender, passportNumber, phone: rawPhone, email: rawEmail } = req.body;

    if (name) user.name = name;
    if (age !== undefined) user.age = age;
    if (gender) user.gender = gender;
    if (passportNumber !== undefined) user.passportNumber = passportNumber;

    if (rawEmail !== undefined) {
      const em = String(rawEmail || '').trim().toLowerCase();
      if (!em) {
        return res.status(400).json({ success: false, message: 'Email cannot be empty' });
      }
      if (!isValidEmail(em)) {
        return res.status(400).json({ success: false, message: 'Enter a valid email address' });
      }
      const taken = await User.findOne({ email: em, _id: { $ne: user._id } });
      if (taken) {
        return res.status(400).json({ success: false, message: 'This email is already registered' });
      }
      user.email = em;
    }

    if (rawPhone !== undefined) {
      const trimmed = String(rawPhone || '').trim();
      if (!trimmed) {
        user.set('phone', undefined);
      } else {
        const normalized = normalizePhoneDigits(trimmed);
        if (!normalized || normalized.length !== 10) {
          return res.status(400).json({ success: false, message: 'Enter a valid 10-digit mobile number' });
        }
        const taken = await User.findOne({ phone: normalized, _id: { $ne: user._id } });
        if (taken) {
          return res.status(400).json({ success: false, message: 'This phone number is already registered' });
        }
        user.phone = normalized;
      }
    }

    const updatedUser = await user.save();
    
    // Return sanitized user
    const { password, ...safeUser } = updatedUser._doc;
    res.json({ success: true, user: safeUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error updating profile' });
  }
};

/**
 * @route   PUT /api/users/change-password
 * @desc    Change user password
 * @access  Private
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // If user registered with Google and has no password, they can't "change" it this way
    if (!user.password) {
      return res.status(400).json({ success: false, message: 'Account uses third-party login. Cannot change password.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: 'Server error changing password' });
  }
};

/**
 * @route   POST /api/users/profile/upload-image
 * @desc    Upload profile image
 * @access  Private
 */
const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a file' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      // Delete uploaded file if user not found
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const profilesDir = path.join(__dirname, '..', 'uploads', 'profiles');
    if (!fs.existsSync(profilesDir)) {
      fs.mkdirSync(profilesDir, { recursive: true });
    }

    // Compress and convert uploaded image to webp
    const filename = `profile-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
    const outputPath = path.join(profilesDir, filename);
    await sharp(req.file.buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(outputPath);

    // Delete old profile image if it exists
    if (user.profileImage) {
      const normalizedOldImagePath = user.profileImage.replace(/^\/+/, '');
      const oldPath = path.join(__dirname, '..', normalizedOldImagePath);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Save new image path relative to server root
    const imagePath = `/uploads/profiles/${filename}`;
    user.profileImage = imagePath;
    await user.save();

    res.json({ success: true, profileImage: imagePath });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error uploading image' });
  }
};

/**
 * @route   POST /api/users/profile/reset-request
 * @desc    Trigger reset password OTP for logged-in user
 * @access  Private
 */
const resetPasswordRequest = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const otp = generateOTP();
    await Otp.deleteMany({ identifier: user.email, purpose: 'password_reset' });
    await Otp.create({ identifier: user.email, otp, purpose: 'password_reset' });
    const resetSent = await sendEmail({
      email: user.email,
      subject: 'Visa & Voyage - Password Reset OTP',
      html: `<p>Your password reset OTP is: <strong>${otp}</strong></p>`
    });

    if (!resetSent) {
      await Otp.deleteMany({ identifier: user.email, purpose: 'password_reset' });
      return res.status(503).json({
        success: false,
        message: EMAIL_OTP_CONFIG_HINT,
      });
    }

    res.json({ success: true, message: 'OTP sent to your registered email' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @route   POST /api/users/forgot-password/request-otp
 * @desc    Send password reset OTP to email or SMS to phone (public)
 * @access  Public
 */
const requestForgotPasswordOtp = async (req, res) => {
  try {
    const raw = req.body.identifier ?? req.body.email ?? '';
    const { type, key } = normalizeLoginIdentifier(raw);

    if (type === 'invalid' || !key) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address or a 10-digit mobile number',
      });
    }

    if (type === 'phone' && !isPhoneLoginOtpEnabled()) {
      return res.status(403).json({
        success: false,
        message: 'Phone reset is disabled. Use your registered email.',
      });
    }

    const user = await findUserForLoginOtp(type, key);
    if (!user) {
      const msg =
        type === 'phone'
          ? 'No account found for this phone number.'
          : 'No account found with this email';
      return res.status(404).json({ success: false, message: msg });
    }

    const otp = generateOTP();
    await Otp.deleteMany({ identifier: key, purpose: 'password_reset' });
    await Otp.create({ identifier: key, otp, purpose: 'password_reset' });

    if (type === 'email') {
      const forgotSent = await sendEmail({
        email: key,
        subject: 'Visa & Voyage - Password Reset OTP',
        html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0d1117; border-radius: 16px; border: 1px solid #21262d;">
          <h2 style="color: #06b6d4; margin-bottom: 8px;">Reset your Visa & Voyage password</h2>
          <p style="color: #8b949e; margin-bottom: 24px;">Use this OTP to reset your password:</p>
          <div style="background: #161b22; border: 2px solid #06b6d4; border-radius: 12px; padding: 24px; text-align: center; letter-spacing: 0.5em; font-size: 32px; font-weight: bold; color: #f0f6fc; font-family: monospace;">${otp}</div>
          <p style="color: #8b949e; font-size: 13px; margin-top: 20px;">This code expires in 10 minutes. Do not share it with anyone.</p>
        </div>
      `
      });

      if (!forgotSent) {
        await Otp.deleteMany({ identifier: key, purpose: 'password_reset' });
        return res.status(503).json({
          success: false,
          message: EMAIL_OTP_CONFIG_HINT,
        });
      }

      return res.json({ success: true, message: 'Password reset OTP sent to your email' });
    }

    let smsResult = await sendLoginOtpSms(key, otp);
    if (smsResult.sent) {
      return res.json({ success: true, message: 'Password reset OTP sent to your phone' });
    }
    if (smsResult.skipped) {
      if (process.env.SUPPRESS_LOGIN_OTP_LOG !== 'true') {
        console.log(
          `\n========== [Forgot password OTP] SMS not configured ==========\n  OTP: ${otp}\n  Phone key: ${key}\n==================================================\n`
        );
      }
      const payload = {
        success: true,
        message:
          'OTP is ready — SMS not configured. Check the server terminal for the code, or configure SMS91 in Admin settings.',
      };
      if (
        process.env.NODE_ENV !== 'production' ||
        process.env.LOGIN_OTP_DEV_REVEAL === 'true'
      ) {
        payload.devOtp = otp;
      }
      return res.json(payload);
    }

    await Otp.deleteMany({ identifier: key, purpose: 'password_reset' });
    return res.status(502).json({
      success: false,
      message: 'Could not send SMS. Please try again in a few minutes.',
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @route   POST /api/users/forgot-password/reset
 * @desc    Verify OTP and reset password (public)
 * @access  Public
 */
const resetForgotPassword = async (req, res) => {
  try {
    const raw = req.body.identifier ?? req.body.email ?? '';
    const { type, key } = normalizeLoginIdentifier(raw);
    const { otp, newPassword } = req.body;

    if (type === 'invalid' || !key) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address or a 10-digit mobile number',
      });
    }

    if (type === 'phone' && !isPhoneLoginOtpEnabled()) {
      return res.status(403).json({ success: false, message: 'Phone reset is disabled.' });
    }

    if (!otp || String(otp).length !== 6) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    if (!newPassword) {
      return res.status(400).json({ success: false, message: 'New password is required' });
    }

    const otpRecord = await Otp.findOne({ identifier: key, otp: String(otp), purpose: 'password_reset' });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const user = await findUserForLoginOtp(type, key);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.password = newPassword;
    if (type === 'phone' && key && /^\d{10}$/.test(String(key))) {
      user.phone = String(key);
    }
    await user.save();
    await Otp.deleteMany({ identifier: key, purpose: 'password_reset' });

    return res.json({ success: true, message: 'Password reset successful. Please login.' });
  } catch (error) {
    console.error(error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  signupUser,
  verifyOtp,
  verifyLoginOtp,
  sendLoginOtp,
  firebaseAuthLogin,
  firebaseGoogleLogin,
  loginUser,
  getUserProfile,
  updateUserProfile,
  uploadProfileImage,
  resetPasswordRequest,
  requestForgotPasswordOtp,
  resetForgotPassword,
  changePassword
};
