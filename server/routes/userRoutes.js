
const express = require('express');
const router = express.Router();
const { 
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
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../utils/uploadConfig');
const { uploadOptimizer, processFiles, saveDocumentsToDisk } = require('../utils/uploadOptimizer');
const {
  submitApplication,
  createCheckoutDraft,
  updateUserApplication,
  appendApplicationDocuments,
  getUserApplicationById,
  getUserApplications,
} = require('../controllers/applicationController');
const { createOrder, verifyPayment, cancelPayment, failPayment, getMyTransactions } = require('../controllers/paymentController');

const handleDocumentUploadMiddleware = (req, res, next) => {
  uploadOptimizer.array('documents', 25)(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds 300KB limit. Please upload a smaller file.',
      });
    }
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || 'Could not process upload.',
    });
  });
};

// Auth routes
router.post('/signup', signupUser);
router.post('/verify-otp', verifyOtp);
router.post('/send-login-otp', sendLoginOtp);
router.post('/verify-login-otp', verifyLoginOtp);
router.post('/firebase-auth', firebaseAuthLogin);
router.post('/firebase-google', firebaseGoogleLogin);
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
router.post('/application/checkout-draft', protect, createCheckoutDraft);
router.put('/applications/:id', protect, updateUserApplication);
router.post(
  '/applications/:id/documents',
  protect,
  handleDocumentUploadMiddleware,
  saveDocumentsToDisk,
  appendApplicationDocuments
);
router.get('/applications/:id', protect, getUserApplicationById);
router.get('/applications', protect, getUserApplications);

// Payment Routes
router.post('/payments/create-order', protect, createOrder);
router.post('/payments/verify', protect, verifyPayment);
router.post('/payments/cancel', protect, cancelPayment);
router.post('/payments/fail', protect, failPayment);
router.get('/payments/my-transactions', protect, getMyTransactions);

module.exports = router;
