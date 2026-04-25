const User = require('../models/User');
const Otp = require('../models/Otp');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');
const { OAuth2Client } = require('google-auth-library');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (id) => {
  return jwt.sign({ id, role: 'user' }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

/**
 * @route   POST /api/users/signup
 * @desc    Register a new user and send OTP
 * @access  Public
 */
const signupUser = async (req, res) => {
  try {
    const { name, identifier: rawId, password } = req.body;
    const identifier = rawId.trim().toLowerCase();
    
    if (!isValidEmail(identifier)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }
    const email = identifier;
    const userExists = await User.findOne({ email });

    if (userExists) {
      // If user exists but is unverified, resend OTP instead of erroring
      if (!userExists.isVerified) {
        await Otp.deleteMany({ identifier, purpose: 'signup' });
        const otp = generateOTP();
        await Otp.create({ identifier, otp, purpose: 'signup' });
        await sendEmail({
          email,
          subject: 'Visa & Voyage - Verify your account',
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0d1117; border-radius: 16px; border: 1px solid #21262d;">
              <h2 style="color: #06b6d4; margin-bottom: 8px;">Welcome to Visa & Voyage!</h2>
              <p style="color: #8b949e; margin-bottom: 24px;">Here's a new verification code for your account:</p>
              <div style="background: #161b22; border: 2px solid #06b6d4; border-radius: 12px; padding: 24px; text-align: center; letter-spacing: 0.5em; font-size: 32px; font-weight: bold; color: #f0f6fc; font-family: monospace;">${otp}</div>
              <p style="color: #8b949e; font-size: 13px; margin-top: 20px;">This code expires in 10 minutes. Do not share it with anyone.</p>
            </div>
          `
        });
        return res.status(201).json({ success: true, message: 'OTP resent. Please verify your account.' });
      }
      return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }

    const user = await User.create({
      name,
      email,
      password
    });

    // Clear old OTPs and create fresh one
    await Otp.deleteMany({ identifier, purpose: 'signup' });
    const otp = generateOTP();
    await Otp.create({ identifier, otp, purpose: 'signup' });

    await sendEmail({
      email,
      subject: 'Visa & Voyage - Verify your account',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0d1117; border-radius: 16px; border: 1px solid #21262d;">
          <h2 style="color: #06b6d4; margin-bottom: 8px;">Welcome to Visa & Voyage!</h2>
          <p style="color: #8b949e; margin-bottom: 24px;">Enter the code below to verify your account:</p>
          <div style="background: #161b22; border: 2px solid #06b6d4; border-radius: 12px; padding: 24px; text-align: center; letter-spacing: 0.5em; font-size: 32px; font-weight: bold; color: #f0f6fc; font-family: monospace;">${otp}</div>
          <p style="color: #8b949e; font-size: 13px; margin-top: 20px;">This code expires in 10 minutes. Do not share it with anyone.</p>
        </div>
      `
    });

    res.status(201).json({ success: true, message: 'OTP sent successfully. Please verify.' });
  } catch (error) {
    console.error(error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
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
    const { identifier, otp } = req.body;
    if (!isValidEmail(identifier)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }

    const otpRecord = await Otp.findOne({ identifier, otp, purpose: 'signup' });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const user = await User.findOne({ email: identifier });
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
        isVerified: user.isVerified
      }
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
    const { identifier: rawId } = req.body;
    const identifier = rawId.trim().toLowerCase();
    if (!isValidEmail(identifier)) {
      return res.status(400).json({ success: false, message: 'Login OTP is available for email only' });
    }

    const user = await User.findOne({ email: identifier });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this identifier' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: 'Account not verified. Please complete signup first.' });
    }

    // Delete any existing OTPs for this identifier to avoid conflicts
    await Otp.deleteMany({ identifier, purpose: 'login' });

    const otp = generateOTP();
    await Otp.create({ identifier, otp, purpose: 'login' });

    await sendEmail({
      email: identifier,
      subject: 'Visa & Voyage - Login OTP',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0d1117; border-radius: 16px; border: 1px solid #21262d;">
          <h2 style="color: #06b6d4; margin-bottom: 8px;">Your Visa & Voyage Login Code</h2>
          <p style="color: #8b949e; margin-bottom: 24px;">Use the code below to sign in to your Visa & Voyage account:</p>
          <div style="background: #161b22; border: 2px solid #06b6d4; border-radius: 12px; padding: 24px; text-align: center; letter-spacing: 0.5em; font-size: 32px; font-weight: bold; color: #f0f6fc; font-family: monospace;">${otp}</div>
          <p style="color: #8b949e; font-size: 13px; margin-top: 20px;">This code expires in 10 minutes. Do not share it with anyone.</p>
        </div>
      `
    });

    res.json({ success: true, message: 'OTP sent for login' });
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
    const { identifier, otp } = req.body;
    if (!isValidEmail(identifier)) {
      return res.status(400).json({ success: false, message: 'Login OTP is available for email only' });
    }

    const otpRecord = await Otp.findOne({ identifier, otp, purpose: 'login' });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const user = await User.findOne({ email: identifier });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this identifier' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: 'Account not verified. Please sign up again.' });
    }

    // Delete the used OTP
    await Otp.deleteOne({ _id: otpRecord._id });

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

/**
 * @route   POST /api/users/login
 * @desc    Standard Password login
 */
const loginUser = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!isValidEmail(identifier)) {
      return res.status(400).json({ success: false, message: 'Please login with your registered email address' });
    }

    const user = await User.findOne({ email: identifier });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.password) {
      return res.status(401).json({ success: false, message: 'Please login using OTP or Google' });
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
    const { name, age, gender, passportNumber } = req.body;

    if (name) user.name = name;
    if (age !== undefined) user.age = age;
    if (gender) user.gender = gender;
    if (passportNumber) user.passportNumber = passportNumber;
    
    // Note: req.body.email is ignored entirely.

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
    await sendEmail({
      email: user.email,
      subject: 'Visa & Voyage - Password Reset OTP',
      html: `<p>Your password reset OTP is: <strong>${otp}</strong></p>`
    });

    res.json({ success: true, message: 'OTP sent to your registered email' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @route   POST /api/users/forgot-password/request-otp
 * @desc    Send password reset OTP to email (public)
 * @access  Public
 */
const requestForgotPasswordOtp = async (req, res) => {
  try {
    const { email: rawEmail } = req.body;
    const email = String(rawEmail || '').trim().toLowerCase();

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email' });
    }

    const otp = generateOTP();
    await Otp.deleteMany({ identifier: email, purpose: 'password_reset' });
    await Otp.create({ identifier: email, otp, purpose: 'password_reset' });

    await sendEmail({
      email,
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

    return res.json({ success: true, message: 'Password reset OTP sent to your email' });
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
    const { email: rawEmail, otp, newPassword } = req.body;
    const email = String(rawEmail || '').trim().toLowerCase();

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }
    if (!otp || String(otp).length !== 6) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    if (!newPassword) {
      return res.status(400).json({ success: false, message: 'New password is required' });
    }

    const otpRecord = await Otp.findOne({ identifier: email, otp: String(otp), purpose: 'password_reset' });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.password = newPassword;
    await user.save();
    await Otp.deleteMany({ identifier: email, purpose: 'password_reset' });

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
  loginUser,
  getUserProfile,
  updateUserProfile,
  uploadProfileImage,
  resetPasswordRequest,
  requestForgotPasswordOtp,
  resetForgotPassword,
  changePassword
};
