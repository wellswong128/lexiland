function normalizeUrl(url) {
  return url.trim().replace(/\/$/, "");
}

export function isLocalhostUrl(url) {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1";
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

export function resolveAuthRedirectUrl({ strict = false } = {}) {
  const configured = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim();
  const runtimeOrigin =
    typeof window !== "undefined"
      ? normalizeUrl(window.location.origin)
      : "";

  // Prefer the site the user is actually on to avoid env/allowlist mismatches.
  if (
    runtimeOrigin &&
    !isLocalhostUrl(runtimeOrigin) &&
    !isLanHost(runtimeOrigin)
  ) {
    return runtimeOrigin;
  }

  if (configured) {
    return normalizeUrl(configured);
  }

  if (!runtimeOrigin) {
    return "";
  }

  if (isLocalhostUrl(runtimeOrigin) || isLanHost(runtimeOrigin)) {
    if (strict) {
      throw new Error(
        "Set VITE_AUTH_REDIRECT_URL to your deployed URL (for example https://your-app.vercel.app) before using email login on mobile.",
      );
    }
  }

  return runtimeOrigin;
}
