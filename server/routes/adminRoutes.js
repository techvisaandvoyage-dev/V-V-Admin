const express = require('express');
const router = express.Router();
const { loginAdmin, changePassword } = require('../controllers/adminController');
const { getAllApplications, getApplicationById, updateApplicationStatus } = require('../controllers/applicationController');
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { getAllTransactions } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

router.post('/login', loginAdmin);
router.put('/change-password', protect, changePassword);

router.get('/applications', protect, getAllApplications);
router.get('/applications/:id', protect, getApplicationById);
router.put('/applications/:id/status', protect, updateApplicationStatus);

// Admin Settings routes
router.get('/settings', protect, getSettings);
router.put('/settings', protect, updateSettings);

// Admin Transactions route
router.get('/transactions', protect, getAllTransactions);

module.exports = router;
