export const getFileUrl = (filePath) => {
  if (!filePath) return "";

  if (typeof filePath === "object") {
    filePath =
      filePath.url ||
      filePath.path ||
      filePath.fileUrl ||
      filePath.documentUrl ||
      filePath.passportUrl ||
      filePath.previewUrl ||
      "";
  }

  if (!filePath) return "";
  
  // Clean up any double quotes if it was stringified
  filePath = String(filePath).replace(/^"|"$/g, "");

  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }

  // If we are in dev or if VITE_API_URL is set, use it.
  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000";

  // Remove any trailing slash from base url
  const baseUrl = API_BASE_URL.replace(/\/+$/, "");

  const normalizedPath = filePath.startsWith("/")
    ? filePath
    : `/${filePath}`;

  return `${baseUrl}${normalizedPath}`;
};
