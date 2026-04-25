
const express = require('express');
const router = express.Router();
const { 
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
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../utils/uploadConfig');
const { uploadOptimizer, processFiles } = require('../utils/uploadOptimizer');
const { submitApplication, getUserApplications } = require('../controllers/applicationController');
const { createOrder, verifyPayment, cancelPayment, getMyTransactions } = require('../controllers/paymentController');

// Auth routes
router.post('/signup', signupUser);
router.post('/verify-otp', verifyOtp);
router.post('/send-login-otp', sendLoginOtp);
router.post('/verify-login-otp', verifyLoginOtp);
router.post('/login', loginUser);
router.post('/forgot-password/request-otp', requestForgotPasswordOtp);
router.post('/forgot-password/reset', resetForgotPassword);

// Profile routes
router.get('/profile', protect, getUserProfile);
router.put('/profile/update', protect, updateUserProfile);
router.post('/profile/upload-image', protect, upload.single('profileImage'), uploadProfileImage);
router.post('/profile/reset-request', protect, resetPasswordRequest);
router.put('/change-password', protect, changePassword);

// Application routes
router.post('/application', protect, uploadOptimizer.array('documents', 5), processFiles, submitApplication);
router.get('/applications', protect, getUserApplications);

// Payment Routes
router.post('/payments/create-order', protect, createOrder);
router.post('/payments/verify', protect, verifyPayment);
router.post('/payments/cancel', protect, cancelPayment);
router.get('/payments/my-transactions', protect, getMyTransactions);

module.exports = router;
