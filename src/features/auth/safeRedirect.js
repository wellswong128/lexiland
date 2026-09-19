const DEFAULT_AUTH_REDIRECT = "/";

function normalizeCandidateRedirectPath(redirectPath) {
  const normalizedRedirect = String(redirectPath || "").trim();

  if (
    !normalizedRedirect.startsWith("/") ||
    normalizedRedirect.startsWith("//")
  ) {
    return "";
  }

  return normalizedRedirect;
}

export function normalizeAuthRedirectPath(redirectPath, fallback = DEFAULT_AUTH_REDIRECT) {
  const safeRedirect = normalizeCandidateRedirectPath(redirectPath);
  if (safeRedirect) {
    return safeRedirect;
  }

  if (fallback === "") {
    return "";
  }

  return normalizeCandidateRedirectPath(fallback) || DEFAULT_AUTH_REDIRECT;
}
