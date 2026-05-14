const express = require('express');
const router = express.Router();
const { loginAdmin, changePassword } = require('../controllers/adminController');
const { getAllApplications, getApplicationById, updateApplicationStatus, uploadApprovedVisaFile } = require('../controllers/applicationController');
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { getAllTransactions } = require('../controllers/paymentController');
const {
  getCountries,
  addCountry,
  updateCountry,
  deleteCountry,
  uploadCountryImage,
  refreshUnsplashCountryImages,
} = require('../controllers/countryController');
const {
  createStaticPage,
  deleteStaticPage,
  getAdminPageById,
  getAdminPages,
  toggleStaticPageStatus,
  updateStaticPage,
  uploadStaticPageImage,
} = require('../controllers/staticPageController');
const blogAdmin = require('../controllers/blogAdminController');
const { listCategoriesAdmin } = require('../controllers/blogCategoryController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Storage for country banner images
const countryImagesDir = path.join(__dirname, '..', 'uploads', 'country-images');
if (!fs.existsSync(countryImagesDir)) fs.mkdirSync(countryImagesDir, { recursive: true });
const pageMediaDir = path.join(__dirname, '..', 'uploads', 'page-media');
if (!fs.existsSync(pageMediaDir)) fs.mkdirSync(pageMediaDir, { recursive: true });
const visaFilesDir = path.join(__dirname, '..', 'uploads', 'visa-files');
if (!fs.existsSync(visaFilesDir)) fs.mkdirSync(visaFilesDir, { recursive: true });

const countryImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, countryImagesDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `country-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});
const pageMediaStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, pageMediaDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `page-media-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});
const visaFileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, visaFilesDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `visa-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});
const countryImageUpload = multer({
  storage: countryImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    /^image\//.test(file.mimetype) ? cb(null, true) : cb(new Error('Only image files are allowed'));
  },
});
const pageMediaUpload = multer({
  storage: pageMediaStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    /^image\//.test(file.mimetype) ? cb(null, true) : cb(new Error('Only image files are allowed'));
  },
});
const visaFileUpload = multer({
  storage: visaFileStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
    ];
    allowedMimeTypes.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Only PDF, PNG, JPG, JPEG, and WEBP files are allowed'));
  },
});
const { protect, requireAdmin } = require('../middleware/authMiddleware');

router.post('/login', loginAdmin);
router.put('/change-password', protect, requireAdmin, changePassword);

router.get('/applications', protect, requireAdmin, getAllApplications);
router.get('/applications/:id', protect, requireAdmin, getApplicationById);
router.post('/applications/:id/visa-file', protect, requireAdmin, visaFileUpload.single('visaFile'), uploadApprovedVisaFile);
router.put('/applications/:id/status', protect, requireAdmin, updateApplicationStatus);

// Admin Settings routes
router.get('/settings', protect, requireAdmin, getSettings);
router.put('/settings', protect, requireAdmin, updateSettings);

// Admin Transactions route
router.get('/transactions', protect, requireAdmin, getAllTransactions);

// Country management (admin only)
router.get('/countries-list', protect, requireAdmin, getCountries);
router.post('/countries/upload-image', protect, requireAdmin, countryImageUpload.single('image'), uploadCountryImage);
router.post('/countries/refresh-unsplash-images', protect, requireAdmin, refreshUnsplashCountryImages);
router.post('/countries', protect, requireAdmin, addCountry);
router.put('/countries/:id', protect, requireAdmin, updateCountry);
router.delete('/countries/:id', protect, requireAdmin, deleteCountry);

// Static pages CMS
router.get('/pages', protect, requireAdmin, getAdminPages);
router.get('/pages/:id', protect, requireAdmin, getAdminPageById);
router.post('/pages/upload-image', protect, requireAdmin, pageMediaUpload.single('image'), uploadStaticPageImage);
router.post('/pages', protect, requireAdmin, createStaticPage);
router.put('/pages/:id', protect, requireAdmin, updateStaticPage);
router.patch('/pages/:id/toggle-status', protect, requireAdmin, toggleStaticPageStatus);
router.delete('/pages/:id', protect, requireAdmin, deleteStaticPage);

// Visa blog CMS
router.get('/blog-categories', protect, requireAdmin, listCategoriesAdmin);
router.get('/blogs', protect, requireAdmin, blogAdmin.listAdminBlogs);
router.get('/comments', protect, requireAdmin, blogAdmin.listAdminComments);
router.delete('/comments/:id', protect, requireAdmin, blogAdmin.adminDeleteComment);
router.patch('/blog/:id/feature', protect, requireAdmin, blogAdmin.toggleFeatureBlog);
router.patch('/comments/:id/pin', protect, requireAdmin, blogAdmin.togglePinComment);
router.get('/blog-reports', protect, requireAdmin, blogAdmin.listReports);
router.patch('/blog-reports/:id', protect, requireAdmin, blogAdmin.updateReport);

module.exports = router;
