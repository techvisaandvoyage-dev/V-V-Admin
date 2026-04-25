const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

// Ensure documents directory exists
const docsDir = path.join(__dirname, '..', 'uploads', 'documents');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

// Memory storage to process images with Sharp before saving
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedFileTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedFileTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only images (jpeg, jpg, png) and PDFs are allowed!'), false);
  }
};

const uploadOptimizer = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB hard limit
  fileFilter: fileFilter
});

/**
 * Middleware to process uploaded files (Sharp for images, direct save for PDFs)
 */
const processFiles = async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next();
  }

  try {
    req.body.documents = []; // We will store final file paths here

    await Promise.all(
      req.files.map(async (file) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        
        // If Image -> Optimize with Sharp
        if (file.mimetype.startsWith('image/')) {
          const filename = `doc-${uniqueSuffix}.webp`;
          const filepath = path.join(docsDir, filename);

          await sharp(file.buffer)
            .resize({ width: 1200, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(filepath);

          req.body.documents.push(`/uploads/documents/${filename}`);
        } 
        // If PDF -> Save directly
        else if (file.mimetype === 'application/pdf') {
          const filename = `doc-${uniqueSuffix}.pdf`;
          const filepath = path.join(docsDir, filename);
          
          fs.writeFileSync(filepath, file.buffer);
          
          req.body.documents.push(`/uploads/documents/${filename}`);
        }
      })
    );

    next();
  } catch (error) {
    console.error("Error processing files:", error);
    res.status(500).json({ success: false, message: "Error processing files during upload" });
  }
};

module.exports = {
  uploadOptimizer,
  processFiles
};
