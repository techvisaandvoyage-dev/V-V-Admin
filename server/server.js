const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const connectDB = require('./config/db');
const path = require('path');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(compression());
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(cors());
app.use(express.json());

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/users', require('./routes/userRoutes'));

// Public Config Routes
const { getRazorpayKeyId } = require('./controllers/settingsController');
app.get('/api/config/razorpay', getRazorpayKeyId);

// ── Serve Static Assets in Production ──────────────────────
if (process.env.NODE_ENV === 'production') {

  const clientBuildPath = path.join(__dirname, '../client/dist');
  const adminBuildPath = path.join(__dirname, '../admin/dist');

  // ✅ Serve Admin App
  app.use('/admin', express.static(adminBuildPath));

  app.get('/admin/*', (req, res) => {
    res.sendFile(path.join(adminBuildPath, 'index.html'));
  });

  // ✅ Serve Client App
  app.use(express.static(clientBuildPath));

  app.get('*', (req, res) => {
    if (
      !req.path.startsWith('/api') &&
      !req.path.startsWith('/uploads') &&
      !req.path.startsWith('/admin')
    ) {
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    }
  });

} else {
  app.get('/', (req, res) => {
    res.send('Visa & Voyage API is running (Development)...');
  });
}

// Server start
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // Auto-seed Admin
  try {
    const Admin = require('./models/Admin');
    const bcrypt = require('bcryptjs');

    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);

      await Admin.create({
        email: 'admin@visa.com',
        password: hashedPassword
      });

      console.log('Default Admin account created: admin@visa.com');
    }

  } catch (err) {
    console.log('Skipping admin seed');
  }
});