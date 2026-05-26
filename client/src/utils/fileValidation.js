/**
 * Generates accepted extensions, MIME types, and display labels based on allowedFileFormats array.
 * Defaults to ["pdf", "jpg", "jpeg", "png"] if invalid or empty.
 */
export const getFileValidationRules = (allowedFormats) => {
  const formats = Array.isArray(allowedFormats) && allowedFormats.length > 0
    ? allowedFormats.map((f) => String(f).toLowerCase().trim())
    : ["pdf", "jpg", "jpeg", "png"];

  const mimeMap = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
  };

  const extMap = {
    pdf: ".pdf",
    jpg: ".jpg",
    jpeg: ".jpeg",
    png: ".png",
  };

  const allowedMimes = new Set();
  const allowedExtensions = [];

  formats.forEach((format) => {
    if (mimeMap[format]) {
      allowedMimes.add(mimeMap[format]);
    }
    if (extMap[format]) {
      allowedExtensions.push(extMap[format]);
    }
  });

  return {
    allowedMimes,
    acceptString: allowedExtensions.join(","),
    displayLabel: formats.map((f) => f.toUpperCase()).join(", "),
    isValidFile: (file) => {
      if (!file) return false;
      const type = String(file.type || "").toLowerCase().trim();
      const name = String(file.name || "").toLowerCase().trim();
      
      // Check MIME type first
      if (allowedMimes.has(type)) {
        return true;
      }
      
      // Fallback: check file extension if MIME is obscure/blank
      const dotIndex = name.lastIndexOf(".");
      if (dotIndex !== -1) {
        const ext = name.substring(dotIndex);
        return allowedExtensions.includes(ext);
      }
      
      return false;
    }
  };
};
