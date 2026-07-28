export function normalizeInAppRedirect(value, fallback = "/") {
  const redirect = String(value || "").trim();

  if (!redirect.startsWith("/") || redirect.startsWith("//")) {
    return fallback;
  }

  return redirect;
}
