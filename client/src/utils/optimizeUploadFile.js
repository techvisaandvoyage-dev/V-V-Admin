import imageCompression from "browser-image-compression";
import { PDFDocument } from "pdf-lib";
import * as pdfjs from "pdfjs-dist";

// Set worker source for pdfjs using a reliable CDN
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export const RAW_UPLOAD_LIMIT_BYTES = 8 * 1024 * 1024;
export const FINAL_UPLOAD_TARGET_BYTES = 300 * 1024;
/** All document uploads now share the same 300 KB target. */
export const PASSPORT_UPLOAD_MAX_BYTES = 300 * 1024;

export const getUploadLimitForDocType = (docKey) => {
  return {
    maxBytes: docKey === "passport" ? PASSPORT_UPLOAD_MAX_BYTES : FINAL_UPLOAD_TARGET_BYTES,
    label: "300 KB",
  };
};

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

const normalizeFileName = (file, nextType) => {
  const original = String(file?.name || "upload").replace(/\.[^.]+$/, "");
  const extensionMap = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
  };
  return `${original}${extensionMap[nextType] || ""}`;
};

const createFileFromBlob = (sourceFile, blob, fallbackType) =>
  new File(
    [blob],
    normalizeFileName(sourceFile, blob.type || fallbackType || sourceFile.type),
    {
      type: blob.type || fallbackType || sourceFile.type,
      lastModified: Date.now(),
    }
  );

/**
 * Aggressively compresses a PDF by rendering each page to a compressed JPEG 
 * and rebuilding a new PDF from those images.
 */
const aggressiveCompressPdf = async (file, targetBytes = FINAL_UPLOAD_TARGET_BYTES) => {
  console.log("Starting aggressive PDF compression for:", file.name, "Size:", file.size);
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    console.log("PDF loaded, pages:", pdf.numPages);
    
    const newPdfDoc = await PDFDocument.create();

    for (let i = 1; i <= pdf.numPages; i++) {
      console.log(`Processing page ${i}/${pdf.numPages}...`);
      const page = await pdf.getPage(i);
      const targetScale = targetBytes <= 300 * 1024 ? 1.0 : 1.2;
      const viewport = page.getViewport({ scale: targetScale });
      
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;
      
      // Convert canvas to compressed JPEG
      const jpegQuality = targetBytes <= 300 * 1024 ? 0.45 : 0.6;
      const imageData = canvas.toDataURL("image/jpeg", jpegQuality);
      const base64 = imageData.split(",")[1];
      const imageBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      
      const image = await newPdfDoc.embedJpg(imageBytes);
      
      const newPage = newPdfDoc.addPage([image.width, image.height]);
      newPage.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      });
    }

    const compressedPdfBytes = await newPdfDoc.save();
    const compressedFile = new File([compressedPdfBytes], file.name, {
      type: "application/pdf",
      lastModified: Date.now(),
    });
    
    console.log("Aggressive compression finished. New size:", compressedFile.size);
    return compressedFile;
  } catch (err) {
    console.error("Aggressive PDF compression failed:", err);
    return file;
  }
};

const optimizePdf = async (file, targetBytes = FINAL_UPLOAD_TARGET_BYTES) => {
  console.log("Attempting standard PDF optimization...");
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    
    const optimizedPdfBytes = await pdfDoc.save({
      useObjectStreams: true,
      objectsPerTick: 50,
      updateFieldAppearances: false,
    });
    
    let optimizedFile = new File([optimizedPdfBytes], file.name, {
      type: "application/pdf",
      lastModified: Date.now(),
    });

    console.log("Standard optimization finished. Size:", optimizedFile.size);

    // If still over limit and > 500KB, use aggressive compression
    if (optimizedFile.size > targetBytes) {
      console.log("File still over limit, switching to aggressive compression...");
      optimizedFile = await aggressiveCompressPdf(file, targetBytes);
    }
    
    return optimizedFile;
  } catch (err) {
    console.error("PDF optimization error:", err);
    return file;
  }
};

const optimizeImage = async (file, targetBytes) => {
  const attempts = [
    {
      maxSizeMB: Math.max(targetBytes / (1024 * 1024), 0.08),
      maxWidthOrHeight: targetBytes <= 300 * 1024 ? 1280 : 1600,
      initialQuality: targetBytes <= 300 * 1024 ? 0.6 : 0.75,
      fileType: file.type === "image/png" ? "image/jpeg" : file.type,
    },
    {
      maxSizeMB: Math.max(targetBytes / (1024 * 1024), 0.06),
      maxWidthOrHeight: targetBytes <= 300 * 1024 ? 1024 : 1280,
      initialQuality: 0.45,
      fileType: "image/jpeg",
    },
    {
      maxSizeMB: Math.max(targetBytes / (1024 * 1024), 0.05),
      maxWidthOrHeight: 900,
      initialQuality: 0.32,
      fileType: "image/jpeg",
    },
  ];

  let bestFile = file;

  for (const attempt of attempts) {
    const compressedBlob = await imageCompression(bestFile, {
      ...attempt,
      useWebWorker: true,
    });

    const compressedFile = createFileFromBlob(file, compressedBlob, attempt.fileType);
    if (compressedFile.size < bestFile.size) {
      bestFile = compressedFile;
    }
    if (bestFile.size <= targetBytes) {
      break;
    }
  }

  return bestFile;
};


export const optimizeUploadFile = async (file, options = {}) => {
  if (!(file instanceof File)) return { file: null };
  const originalSize = file.size;
  const targetBytes = Number.isFinite(Number(options?.targetBytes))
    ? Number(options.targetBytes)
    : FINAL_UPLOAD_TARGET_BYTES;

  if (file.size > RAW_UPLOAD_LIMIT_BYTES) {
    return { error: "File must be below 8 MB." };
  }

  // Handle PDF Optimization
  if (file.type === "application/pdf") {
    const optimizedFile = await optimizePdf(file, targetBytes);
    return {
      file: optimizedFile,
      originalSize,
      compressedSize: optimizedFile.size,
      wasCompressed: optimizedFile.size < originalSize,
    };
  }

  // Handle Image Optimization
  if (!IMAGE_MIME_TYPES.has(file.type)) {
    return { file, originalSize, compressedSize: file.size, wasCompressed: false };
  }

  try {
    const optimizedFile = await optimizeImage(file, targetBytes);

    return {
      file: optimizedFile,
      originalSize,
      compressedSize: optimizedFile.size,
      wasCompressed: optimizedFile.size < originalSize,
    };
  } catch {
    return { error: "Could not optimize this image for upload." };
  }
};
