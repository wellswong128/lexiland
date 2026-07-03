import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { APP_HOME_URL } from "../../lib/appUrl.js";

function normalizeUrl(url) {
  return url.trim().replace(/\/$/, "");
}

export function toAuthCallbackUrl(url) {
  const normalized = normalizeUrl(url);

  if (!normalized) {
    return "";
  }

  try {
    const parsedUrl = new URL(normalized);
    if (parsedUrl.pathname === "" || parsedUrl.pathname === "/") {
      return `${normalized}/auth/callback`;
    }
  } catch {
    // Custom schemes such as com.lexiland.app://auth/callback still parse in URL,
    // but keep this fallback so a malformed env value does not break login setup.
  }

  return normalized;
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

export function getNativeHttpsAuthCallbackUrl() {
  return `${APP_HOME_URL}/auth/callback`;
}

let cachedNativeAppId = null;
let nativeAppIdPromise = null;

export async function preloadNativeAppId() {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  if (cachedNativeAppId) {
    return cachedNativeAppId;
  }

  if (!nativeAppIdPromise) {
    nativeAppIdPromise = App.getInfo()
      .then((info) => {
        cachedNativeAppId = info.id || null;
        return cachedNativeAppId;
      })
      .catch(() => null);
  }

  return nativeAppIdPromise;
}

export function getNativeAppIdSync() {
  return cachedNativeAppId;
}

export function getNativeAuthRedirectUrl() {
  const envUrl = import.meta.env.VITE_NATIVE_AUTH_REDIRECT_URL?.trim();

  if (envUrl) {
    return toAuthCallbackUrl(envUrl);
  }

  if (typeof window !== "undefined" && Capacitor.isNativePlatform()) {
    return toAuthCallbackUrl(window.location.origin);
  }

  const appId = import.meta.env.VITE_CAPACITOR_APP_ID?.trim();

  if (appId) {
    return `${appId}://auth/callback`;
  }

  return getNativeHttpsAuthCallbackUrl();
}

export async function resolveAuthRedirectUrlAsync({ strict = false } = {}) {
  if (Capacitor.isNativePlatform()) {
    await preloadNativeAppId();
    return getNativeAuthRedirectUrl();
  }

  return resolveAuthRedirectUrl({ strict });
}

export function getSupabaseRedirectUrlHints() {
  const hints = new Set([
    "capacitor://localhost/auth/callback",
    "capacitor://localhost/**",
    "capacitor://**",
    "https://localhost/auth/callback",
    "https://localhost/**",
    "http://localhost:5173/auth/callback",
    "http://localhost:5173/**",
    `${APP_HOME_URL}/auth/callback`,
    `${APP_HOME_URL}/**`,
  ]);

  if (typeof window !== "undefined") {
    const runtimeOrigin = normalizeUrl(window.location.origin);
    if (runtimeOrigin) {
      hints.add(toAuthCallbackUrl(runtimeOrigin));
      hints.add(`${runtimeOrigin}/**`);
    }
  }

  const nativeRedirect = getNativeAuthRedirectUrl();
  hints.add(nativeRedirect);
  hints.add(`${nativeRedirect}/**`);

  const appId = getNativeAppIdSync() || import.meta.env.VITE_CAPACITOR_APP_ID?.trim();
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

  // Local dev should always use the current origin callback, even when env points at production.
  if (runtimeOrigin && (isLocalhostUrl(runtimeOrigin) || isLanHost(runtimeOrigin))) {
    return toAuthCallbackUrl(runtimeOrigin);
  }

  if (runtimeOrigin) {
    return toAuthCallbackUrl(runtimeOrigin);
  }

  if (configured) {
    return toAuthCallbackUrl(configured);
  }

  if (!runtimeOrigin) {
    return strict ? getNativeHttpsAuthCallbackUrl() : "";
  }

  if (isLocalhostUrl(runtimeOrigin) || isLanHost(runtimeOrigin)) {
    if (strict) {
      throw new Error(
        `Set VITE_APP_URL or VITE_AUTH_REDIRECT_URL to ${APP_HOME_URL} before using email login on mobile.`,
      );
    }
  }

  return toAuthCallbackUrl(runtimeOrigin);
}
