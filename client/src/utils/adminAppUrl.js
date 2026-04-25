const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

const normalizePath = (path = "/") => {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
};

export const getAdminAppUrl = (path = "/") => {
  const normalizedPath = normalizePath(path);

  if (typeof window !== "undefined" && LOCAL_HOSTS.has(window.location.hostname)) {
    const adminOrigin = import.meta.env.VITE_ADMIN_APP_ORIGIN || "http://localhost:5174";
    return `${adminOrigin}${normalizedPath}`;
  }

  // Production path assumption: admin is hosted under /admin
  return `/admin${normalizedPath === "/" ? "" : normalizedPath}`;
};

