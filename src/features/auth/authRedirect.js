import { Capacitor } from "@capacitor/core";

function normalizeUrl(url) {
  return url.trim().replace(/\/$/, "");
}

export function isLocalhostUrl(url) {
  try {
    const { hostname, protocol } = new URL(url);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      protocol === "capacitor:" ||
      protocol === "ionic:"
    );
  } catch {
    return false;
  }
}

function isLanHost(url) {
  try {
    const { hostname } = new URL(url);
    return (
      /^192\.168\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    );
  } catch {
    return false;
  }
}

export function getNativeAuthRedirectUrl() {
  const envUrl = import.meta.env.VITE_NATIVE_AUTH_REDIRECT_URL?.trim();

  if (envUrl) {
    return normalizeUrl(envUrl);
  }

  const appId = import.meta.env.VITE_CAPACITOR_APP_ID?.trim();

  if (appId) {
    return `${appId}://auth/callback`;
  }

  if (typeof window !== "undefined") {
    return normalizeUrl(window.location.origin);
  }

  return "capacitor://localhost";
}

export function getSupabaseRedirectUrlHints() {
  const hints = new Set([
    "capacitor://localhost",
    "capacitor://localhost/**",
    "https://localhost",
    "https://localhost/**",
  ]);

  const nativeRedirect = getNativeAuthRedirectUrl();
  hints.add(nativeRedirect);
  hints.add(`${nativeRedirect}/**`);

  const appId = import.meta.env.VITE_CAPACITOR_APP_ID?.trim();
  if (appId) {
    hints.add(`${appId}://auth/callback`);
    hints.add(`${appId}://**`);
  }

  return [...hints];
}

export function resolveAuthRedirectUrl({ strict = false } = {}) {
  if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
    return getNativeAuthRedirectUrl();
  }

  const configuredAppUrl = import.meta.env.VITE_APP_URL?.trim();
  const configuredAuthUrl = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim();
  const configured = configuredAppUrl || configuredAuthUrl;
  const runtimeOrigin =
    typeof window !== "undefined" ? normalizeUrl(window.location.origin) : "";

  if (runtimeOrigin && !isLocalhostUrl(runtimeOrigin) && !isLanHost(runtimeOrigin)) {
    return runtimeOrigin;
  }

  if (configured) {
    return normalizeUrl(configured);
  }

  if (!runtimeOrigin) {
    return strict ? "https://learn.lexiland.cc" : "";
  }

  if (isLocalhostUrl(runtimeOrigin) || isLanHost(runtimeOrigin)) {
    if (strict) {
      throw new Error(
        "Set VITE_APP_URL or VITE_AUTH_REDIRECT_URL to https://learn.lexiland.cc before using email login on mobile.",
      );
    }
  }

  return runtimeOrigin;
}
