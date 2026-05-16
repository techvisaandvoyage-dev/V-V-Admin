const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const { getFirebaseAdminApp } = require('./firebaseAdmin');

const FINAL_DOCUMENT_LIMIT_BYTES = 500 * 1024;
const RAW_UPLOAD_LIMIT_BYTES = 8 * 1024 * 1024;

const docsDir = path.join(__dirname, '..', 'uploads', 'documents');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

const storage = multer.memoryStorage();

const createUploadValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const fileFilter = (req, file, cb) => {
  const allowedFileTypes = /jpeg|jpg|png|webp|pdf/;
  const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedFileTypes.test(file.mimetype);

  if (extname || mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only images (jpeg, jpg, png, webp) and PDFs are allowed!'), false);
  }
};

const uploadOptimizer = multer({
  storage,
  limits: { fileSize: RAW_UPLOAD_LIMIT_BYTES },
  fileFilter,
});

const saveBufferToLocalDocuments = async (buffer, filename) => {
  const targetPath = path.join(docsDir, filename);
  await fs.promises.writeFile(targetPath, buffer);
  return `/uploads/documents/${filename}`;
};

const optimizeImageBuffer = async (buffer, mimetype) => {
  const pipeline = sharp(buffer, { failOn: 'none' }).rotate().resize({
    width: 1600,
    height: 1600,
    fit: 'inside',
    withoutEnlargement: true,
  });

  if (mimetype === 'image/png') {
    return pipeline.png({ compressionLevel: 9, palette: true, quality: 80 }).toBuffer();
  }
  if (mimetype === 'image/webp') {
    return pipeline.webp({ quality: 80 }).toBuffer();
  }
  return pipeline.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
};

const optimizePdfBuffer = async (buffer) => {
  const pdfDoc = await PDFDocument.load(buffer, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  return pdfDoc.save({
    useObjectStreams: true,
    objectsPerTick: 50,
    updateFieldAppearances: false,
  });
};

const optimizeUploadedFile = async (file) => {
  if (!file?.buffer) {
    throw createUploadValidationError('No upload buffer found.');
  }

  let buffer = file.buffer;
  let mimetype = String(file.mimetype || '').toLowerCase();

  if (mimetype.startsWith('image/')) {
    buffer = await optimizeImageBuffer(buffer, mimetype);
  } else if (mimetype === 'application/pdf') {
    buffer = await optimizePdfBuffer(buffer);
  }

  if (buffer.length > FINAL_DOCUMENT_LIMIT_BYTES) {
    throw createUploadValidationError('Optimized file must be below 500 KB.');
  }

  return { buffer, mimetype };
};

const uploadToFirebase = async (buffer, filename, mimetype, options = {}) => {
  const { allowLocalFallback = false } = options;
  try {
    const app = await getFirebaseAdminApp();
    const bucket = app.storage().bucket();

    if (!bucket.name) {
      throw new Error('Firebase Storage bucket is not configured. Add it in Admin -> Settings.');
    }

    const file = bucket.file(`documents/${filename}`);
    await file.save(buffer, {
      metadata: { contentType: mimetype },
    });
    await file.makePublic();

    return `https://storage.googleapis.com/${bucket.name}/documents/${filename}`;
  } catch (error) {
    console.error('Firebase Upload Error:', error);
    if (allowLocalFallback) {
      console.warn(`Falling back to local document storage for ${filename}`);
      return saveBufferToLocalDocuments(buffer, filename);
    }
    throw error;
  }
};

const buildStoredFilename = (file, prefix = 'doc') => {
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const extension = path.extname(file.originalname).toLowerCase() || (
    file.mimetype === 'application/pdf'
      ? '.pdf'
      : file.mimetype === 'image/png'
        ? '.png'
        : file.mimetype === 'image/webp'
          ? '.webp'
          : '.jpg'
  );
  return `${prefix}-${uniqueSuffix}${extension}`;
};

const processFiles = async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next();
  }

  try {
    req.body.documents = [];

    await Promise.all(
      req.files.map(async (file) => {
        const optimized = await optimizeUploadedFile(file);
        const filename = buildStoredFilename(file);
        const firebaseUrl = await uploadToFirebase(
          optimized.buffer,
          filename,
          optimized.mimetype,
          { allowLocalFallback: true }
        );
        req.body.documents.push(firebaseUrl);
      })
    );

    next();
  } catch (error) {
    console.error('Error processing files:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.statusCode === 400
          ? error.message
          : error.message.includes('Firebase')
            ? error.message
            : 'Error uploading documents to cloud storage',
    });
  }
};

const saveDocumentsToDisk = async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: 'No files uploaded' });
  }

  try {
    const paths = [];
    await Promise.all(
      req.files.map(async (file) => {
        const optimized = await optimizeUploadedFile(file);
        const filename = buildStoredFilename(file);
        const savedPath = await uploadToFirebase(
          optimized.buffer,
          filename,
          optimized.mimetype,
          { allowLocalFallback: true }
        );
        paths.push(savedPath);
      })
    );
    req.savedDocumentPaths = paths;
    next();
  } catch (error) {
    console.error('Error saving documents:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.statusCode === 400
          ? error.message
          : error.message.includes('Firebase')
            ? error.message
            : 'Error uploading documents to cloud storage',
    });
  }
};

module.exports = {
  uploadOptimizer,
  processFiles,
  saveDocumentsToDisk,
  uploadToFirebase,
  optimizeUploadedFile,
};
