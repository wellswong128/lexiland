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
  const configuredAppUrl = import.meta.env.VITE_APP_URL?.trim();
  const configuredAuthUrl = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim();
  const configured = configuredAppUrl || configuredAuthUrl;
  const runtimeOrigin =
    typeof window !== "undefined"
      ? normalizeUrl(window.location.origin)
      : "";

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
