/**
 * DATA CLEANUP SCRIPT
 * Deletes all Applications and Transactions from the database.
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const Application = require('./models/Application');
const Transaction = require('./models/Transaction');

async function clearData() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/visa-voyage';
    console.log('Connecting to database...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB.');

    // 1. Delete Applications
    const appResult = await Application.deleteMany({});
    console.log(`🗑️ Deleted ${appResult.deletedCount} Applications.`);

    // 2. Delete Transactions
    const txResult = await Transaction.deleteMany({});
    console.log(`🗑️ Deleted ${txResult.deletedCount} Transactions.`);

    // 3. Clear Uploads folder (just files, keep dir)
    const uploadsDir = path.join(__dirname, 'uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      }
      console.log('📂 Cleared uploads folder.');
    }

    console.log('\n✨ Database and files have been cleared successfully.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    process.exit(1);
  }
}

clearData();
