const SAME_ORIGIN_REDIRECT_BASE = "https://lexiland.local";

export function normalizeSameOriginRedirectPath(redirectPath, fallback = "/") {
  const normalizedRedirect = String(redirectPath || "").trim();

  if (!normalizedRedirect.startsWith("/")) {
    return fallback;
  }

  try {
    const redirectUrl = new URL(normalizedRedirect, SAME_ORIGIN_REDIRECT_BASE);

    if (redirectUrl.origin !== SAME_ORIGIN_REDIRECT_BASE) {
      return fallback;
    }

    return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
  } catch {
    return fallback;
  }
}
