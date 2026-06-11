import { resolveAuthRedirectUrl } from "./authRedirect.js";

export function getFriendlyAuthError(message, t) {
  const lower = message.toLowerCase();

  if (lower.includes("rate limit")) {
    return t("settings.rateLimit");
  }

  if (
    lower.includes("redirect") ||
    lower.includes("url configuration") ||
    lower.includes("invalid url")
  ) {
    return t("settings.redirectUrlError", {
      url: resolveAuthRedirectUrl() || t("settings.notConfigured"),
    });
  }

  if (lower.includes("signup") || lower.includes("sign ups")) {
    return t("settings.signupsDisabled");
  }

  if (
    lower.includes("not authorized") ||
    lower.includes("email address is invalid") ||
    lower.includes("invalid email")
  ) {
    return t("settings.emailNotAuthorized");
  }

  if (
    lower.includes("redirect url is not configured") ||
    lower.includes("vite_auth_redirect_url")
  ) {
    return t("settings.redirectNotConfigured");
  }

  return message;
}
