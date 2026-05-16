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

const { getFirebaseAdminApp } = require('../utils/firebaseAdmin');

const generateToken = (id) => {
  return jwt.sign({ id: String(id), role: 'user' }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};

/** Phone OTP is enabled unless ENABLE_PHONE_LOGIN_OTP=false in env. */
const isPhoneLoginOtpEnabled = () => process.env.ENABLE_PHONE_LOGIN_OTP !== 'false';

const EMAIL_OTP_CONFIG_HINT =
  'Could not send email. Configure SMTP in Admin → Settings, or set EMAIL_USER and EMAIL_PASS in server/.env (see server/.env.example).';



const buildOtpBoxes = (otp) =>
  String(otp || '')
    .split('')
    .map(
      (digit) => `
        <td style="padding: 0 6px 12px 6px;">
          <div style="width: 56px; height: 64px; line-height: 64px; text-align: center; border-radius: 12px; border: 1px solid #38558f; background: #13203d; color: #f8fbff; font-size: 34px; font-weight: 700; box-shadow: 0 12px 28px rgba(6, 15, 36, 0.35); font-family: Arial, sans-serif;">
            ${digit}
          </div>
        </td>`
    )
    .join('');

const buildOtpEmailTemplate = ({
  preheader = 'Your VisaAndVoyage verification code is inside.',
  title = 'Your OTP Code',
  subtitle = 'Use the code below to continue.',
  otp,
  note = 'This OTP is valid for 10 minutes only. Do not share it with anyone.',
  accentLabel = 'VisaAndVoyage',
}) => `
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${preheader}
  </div>
  <div style="margin:0; padding:24px 12px; background:#081120; font-family: Arial, Helvetica, sans-serif; color:#e7f1ff;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:720px; margin:0 auto; background:#0d1730; border:1px solid #243a67; border-radius:24px; overflow:hidden; box-shadow:0 18px 42px rgba(3, 8, 20, 0.45);">
      <tr>
        <td style="padding:28px 32px 20px 32px; background:linear-gradient(180deg, #13203d 0%, #0d1730 100%);">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td align="left" style="font-size:14px; color:#7cb6ff; font-weight:600; padding-bottom:20px;">
                <span style="display:inline-block; width:42px; height:42px; line-height:42px; text-align:center; border-radius:50%; background:#1f3d73; color:#e7f1ff; font-size:22px; margin-right:10px;">V</span>
                <span style="font-size:18px; font-weight:700; color:#f8fbff; vertical-align:top; line-height:42px;">${accentLabel}</span>
              </td>
              <td align="right" style="font-size:15px; color:#8ec5ff; font-weight:500; padding-bottom:20px;">
                Your Journey, Our Priority
              </td>
            </tr>
          </table>

          <div style="text-align:center; padding:12px 0 6px 0;">
            <div style="font-size:18px; font-weight:600; color:#7cb6ff; letter-spacing:0.04em; text-transform:uppercase;">Secure Verification</div>
            <h1 style="margin:14px 0 10px 0; font-size:42px; line-height:1.1; color:#f8fbff;">${title}</h1>
            <p style="margin:0 auto; max-width:460px; font-size:22px; line-height:1.5; color:#bfd5f6;">
              ${subtitle}
            </p>
          </div>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:32px auto 16px auto;">
            <tr>
              ${buildOtpBoxes(otp)}
            </tr>
          </table>

          <div style="text-align:center; padding:8px 0 10px 0;">
            <div style="display:inline-block; padding:14px 20px; border-radius:16px; background:#162748; color:#dbe7ff; font-size:18px; line-height:1.6; border:1px solid #2a467c;">
              ${note}
            </div>
          </div>
        </td>
      </tr>

      <tr>
        <td style="background:linear-gradient(180deg, #183c79 0%, #0f2451 100%); padding:22px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="33.33%" valign="top" style="padding-right:12px; color:#ffffff;">
                <div style="font-size:18px; font-weight:700; margin-bottom:6px;">Secure</div>
                <div style="font-size:15px; line-height:1.6; color:#d9e7ff;">Your verification code is protected and time-bound.</div>
              </td>
              <td width="33.33%" valign="top" style="padding:0 12px; color:#ffffff;">
                <div style="font-size:18px; font-weight:700; margin-bottom:6px;">Fast</div>
                <div style="font-size:15px; line-height:1.6; color:#d9e7ff;">Use this OTP to complete your action without delay.</div>
              </td>
              <td width="33.33%" valign="top" style="padding-left:12px; color:#ffffff;">
                <div style="font-size:18px; font-weight:700; margin-bottom:6px;">Support</div>
                <div style="font-size:15px; line-height:1.6; color:#d9e7ff;">If this was not you, you can safely ignore this email.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:22px 32px 28px 32px; text-align:center; background:#0d1730; color:#9eb6d9; font-size:15px; line-height:1.7; border-top:1px solid #20355d;">
          If you did not request this code, no action is needed.<br />
          &copy; 2026 VisaAndVoyage. All rights reserved.
        </td>
      </tr>
    </table>
  </div>
`;

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
            html: buildOtpEmailTemplate({
              preheader: 'Your fresh Visa & Voyage verification code is ready.',
              title: 'Your OTP Code',
              subtitle: "Use the following One-Time Password (OTP) to verify your email and continue.",
              otp,
            }),
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
        html: buildOtpEmailTemplate({
          preheader: 'Verify your Visa & Voyage account with this OTP.',
          title: 'Your OTP Code',
          subtitle: 'Use the following One-Time Password (OTP) to verify your email and continue.',
          otp,
        }),
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
              'OTP is ready.',
          };
          if (process.env.LOGIN_OTP_DEV_REVEAL === 'true') {
            payload.devOtp = otp;
          }
          return res.status(201).json(payload);
        }
        await Otp.deleteMany({ identifier, purpose: 'signup' });
        return res.status(502).json({
          success: false,
          message: 'Could not send the verification code. Please try again.',
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
          'Account created. OTP is ready.',
      };
      if (process.env.LOGIN_OTP_DEV_REVEAL === 'true') {
        payload.devOtp = otp;
      }
      return res.status(201).json(payload);
    }

    await Otp.deleteMany({ identifier, purpose: 'signup' });
    await User.findByIdAndDelete(user._id);
    return res.status(502).json({
      success: false,
      message: 'Could not send the verification code. Please try again.',
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
        html: buildOtpEmailTemplate({
          preheader: 'Your Visa & Voyage login OTP is ready.',
          title: 'Your OTP Code',
          subtitle: 'Use the following One-Time Password (OTP) to log in to your account securely.',
          otp,
          note: `This ${otpLength}-digit OTP is valid for 10 minutes only. Do not share it with anyone.`,
        })
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
          message: 'Could not send the login code. Please try again in a few minutes.',
        });
      }
    }

    const payload = {
      success: true,
      message:
        type === 'email'
          ? 'OTP sent to your email'
          : smsResult?.skipped
            ? 'OTP sent to your registered number'
            : 'OTP sent to your registered number',
    };
    /** Only reveal dev OTP when explicitly enabled. */
    const revealLoginOtp = process.env.LOGIN_OTP_DEV_REVEAL === 'true';
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
    
    const buffer = await sharp(req.file.buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const { uploadToFirebase } = require('../utils/uploadOptimizer');
    const firebaseUrl = await uploadToFirebase(buffer, filename, 'image/webp');

    // Save new image path relative to server root
    user.profileImage = firebaseUrl;
    await user.save();

    res.json({ success: true, profileImage: firebaseUrl });
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
        html: buildOtpEmailTemplate({
          preheader: 'Use this OTP to reset your Visa & Voyage password.',
          title: 'Reset OTP Code',
          subtitle: 'Use the following One-Time Password (OTP) to reset your password and continue.',
          otp,
        })
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
          'Password reset OTP sent to your phone',
      };
      if (process.env.LOGIN_OTP_DEV_REVEAL === 'true') {
        payload.devOtp = otp;
      }
      return res.json(payload);
    }

    await Otp.deleteMany({ identifier: key, purpose: 'password_reset' });
    return res.status(502).json({
      success: false,
      message: 'Could not send the reset code. Please try again in a few minutes.',
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

