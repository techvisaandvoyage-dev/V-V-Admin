const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const connectDB = require('./config/db');

// Load env from server/ so `npm run server` from repo root still finds MONGO_URI, etc.
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.set('trust proxy', 1); // Render / other reverse proxies

// Middleware
app.use(compression());
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(cors());
app.use(express.json());

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Admin universal controls — mounted on `app` (not only inside the admin router) so
// POST /api/admin/control/* always resolves the same way as other first-class routes.
const { protect, requireAdmin } = require('./middleware/authMiddleware');
const {
  getGlobalCountryDefaults,
  updateGlobalVisaType,
  updateGlobalValidity,
  updateGlobalLengthOfStay,
  updateGlobalEntryType,
  updateGlobalProcessingDays,
  updateGlobalRequiredDocuments,
  manageCustomDocuments,
  updateCountryDisplayToggles,
} = require('./controllers/countryController');
app.get('/api/admin/control/country-defaults', protect, requireAdmin, getGlobalCountryDefaults);
app.post('/api/admin/control/visa-type', protect, requireAdmin, updateGlobalVisaType);
app.post('/api/admin/control/validity', protect, requireAdmin, updateGlobalValidity);
app.post('/api/admin/control/length-of-stay', protect, requireAdmin, updateGlobalLengthOfStay);
app.post('/api/admin/control/entry-type', protect, requireAdmin, updateGlobalEntryType);
app.post('/api/admin/control/processing-days', protect, requireAdmin, updateGlobalProcessingDays);
app.post('/api/admin/control/required-documents', protect, requireAdmin, updateGlobalRequiredDocuments);
app.post('/api/admin/control/custom-documents', protect, requireAdmin, manageCustomDocuments);
app.post('/api/admin/control/display-toggles', protect, requireAdmin, updateCountryDisplayToggles);

// Routes
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/users', require('./routes/userRoutes'));

// Public Config Routes
const {
  getRazorpayKeyId,
  getPaymentConfig,
  getFirebaseConfig,
  getUploadSettings,
  getDestinationPageContent,
} = require('./controllers/settingsController');
app.get('/api/config/razorpay', getRazorpayKeyId);
app.get('/api/config/payment', getPaymentConfig);
app.get('/api/config/firebase', getFirebaseConfig);
app.get('/api/config/upload-settings', getUploadSettings);
app.get('/api/config/destination-content', getDestinationPageContent);

// Public Countries Routes
const { getCountries, getCountryBySlug } = require('./controllers/countryController');
const { getPublicPageBySlug, getPublicPages } = require('./controllers/staticPageController');
app.get('/api/countries', getCountries);
app.get('/api/countries/:slug', getCountryBySlug);
app.get('/api/pages', getPublicPages);
app.get('/api/pages/:slug', getPublicPageBySlug);

app.use('/api/blog', require('./routes/blogRoutes'));
app.use('/api/comments', require('./routes/commentRoutes'));

const { searchPlaces } = require('./controllers/geocodeController');
app.get('/api/geocode/places', searchPlaces);

// ✅ Simple test route (IMPORTANT)
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Server start (wait for DB so MONGO_URI errors fail before binding the port)
const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();

  app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);

    // ── Seed default admin ───────────────────────────────────────
    try {
      const Admin = require('./models/Admin');
      const bcrypt = require('bcryptjs');

      const adminCount = await Admin.countDocuments();
      if (adminCount === 0) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);
        await Admin.create({ email: 'admin@visa.com', password: hashedPassword });
        console.log('Default Admin account created: admin@visa.com');
      }
    } catch (err) {
      console.log('Skipping admin seed');
    }

    // ── Seed countries on first boot + keep list at 195 ───────────
    try {
      const { seedCountries, syncMissingCountries } = require('./seedCountries');
      await seedCountries();
      await syncMissingCountries();
    } catch (err) {
      console.log('Skipping country seed:', err.message);
    }

    // ── Seed default static CMS pages (Terms & Conditions, etc.) ──
    // Idempotent: inserts only when slug is missing, never overwrites admin
    // edits. Failures here must not block server boot.
    try {
      const { seedStaticPages } = require('./seedStaticPages');
      await seedStaticPages();
    } catch (err) {
      console.log('Skipping static page seed:', err.message);
    }

    // ── Seed sample blog categories + posts ─────────────────────
    // Same idempotent contract: skips items whose slug is already present so
    // admin edits and deletions persist across restarts.
    try {
      const { seedBlog } = require('./seedBlog');
      const result = await seedBlog();
      if (result.ok && result.postsInserted) {
        console.log(`Seeded ${result.postsInserted} sample blog posts.`);
      }
    } catch (err) {
      console.log('Skipping blog seed:', err.message);
    }
  });
})();
