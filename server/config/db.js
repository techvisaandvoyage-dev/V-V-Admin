const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // ❌ Yahan se options hata diye gaye hain
    const conn = await mongoose.connect(process.env.MONGO_URI);
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1); // Error aane par server rok dega
  }
};

module.exports = connectDB;