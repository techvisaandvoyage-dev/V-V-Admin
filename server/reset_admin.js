const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
dotenv.config();

const AdminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true }
}, { timestamps: true });

const Admin = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);

const resetAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Delete ALL existing admins
    const deleteResult = await Admin.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} existing admin(s).`);

    // Create fresh one
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    const newAdmin = await Admin.create({
      email: 'admin@visa.com',
      password: hashedPassword
    });

    console.log('✅ Fresh admin created:');
    console.log('   Email:', newAdmin.email);
    console.log('   Password (plain): admin123');
    console.log('   Password (hashed):', newAdmin.password);

    // Verify it works
    const isMatch = await bcrypt.compare('admin123', newAdmin.password);
    console.log('   Verification check:', isMatch ? '✅ PASS' : '❌ FAIL');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

resetAdmin();
