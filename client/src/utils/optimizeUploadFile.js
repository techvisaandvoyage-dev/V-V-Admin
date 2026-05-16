import imageCompression from "browser-image-compression";
import { PDFDocument } from "pdf-lib";
import * as pdfjs from "pdfjs-dist";

// Set worker source for pdfjs using a reliable CDN
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export const RAW_UPLOAD_LIMIT_BYTES = 8 * 1024 * 1024;
export const FINAL_UPLOAD_TARGET_BYTES = 500 * 1024;

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

/**
 * Aggressively compresses a PDF by rendering each page to a compressed JPEG 
 * and rebuilding a new PDF from those images.
 */
const aggressiveCompressPdf = async (file) => {
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
      const viewport = page.getViewport({ scale: 1.2 }); // Slightly lower scale for better compression
      
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;
      
      // Convert canvas to compressed JPEG
      const imageData = canvas.toDataURL("image/jpeg", 0.6); // Lower quality (60%) for smaller size
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

const optimizePdf = async (file) => {
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
    if (optimizedFile.size > FINAL_UPLOAD_TARGET_BYTES) {
      console.log("File still over limit, switching to aggressive compression...");
      optimizedFile = await aggressiveCompressPdf(file);
    }
    
    return optimizedFile;
  } catch (err) {
    console.error("PDF optimization error:", err);
    return file;
  }
};


export const optimizeUploadFile = async (file) => {
  if (!(file instanceof File)) return { file: null };
  const originalSize = file.size;

  if (file.size > RAW_UPLOAD_LIMIT_BYTES) {
    return { error: "File must be below 8 MB." };
  }

  // Handle PDF Optimization
  if (file.type === "application/pdf") {
    const optimizedFile = await optimizePdf(file);
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
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.48,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      initialQuality: 0.8,
      fileType: file.type === "image/png" ? "image/png" : file.type,
    });

    const optimizedFile = new File(
      [compressed],
      normalizeFileName(file, compressed.type || file.type),
      {
        type: compressed.type || file.type,
        lastModified: Date.now(),
      }
    );

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


