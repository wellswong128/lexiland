import { APP_HOME_URL } from "./appUrl.js";

const DEFAULT_API_BASE_URL = APP_HOME_URL;

function isCapacitorLikeOrigin(origin) {
  if (!origin || origin === "null") {
    return true;
  }

  return (
    origin.startsWith("capacitor://") ||
    origin.startsWith("ionic://") ||
    origin === "https://localhost" ||
    origin === "http://localhost"
  );
}

export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (typeof window !== "undefined" && isCapacitorLikeOrigin(window.location.origin)) {
    return DEFAULT_API_BASE_URL;
  }

  return "";
}

export function resolveApiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = getApiBaseUrl();

  if (!baseUrl) {
    return normalizedPath;
  }

  return `${baseUrl}${normalizedPath}`;
}
