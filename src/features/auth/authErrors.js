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
    lower.includes("error sending magic link") ||
    lower.includes("error sending confirmation email") ||
    lower.includes("error sending email") ||
    lower.includes("smtp")
  ) {
    if (lower.includes("email sending not authorized")) {
      return t("settings.magicLinkDomainNotAuthorized");
    }

    return t("settings.magicLinkEmailFailed");
  }

  if (
    lower.includes("error getting user email from external provider") ||
    lower.includes("error getting user profile from external provider") ||
    (lower.includes("microsoft") && lower.includes("email"))
  ) {
    return t("settings.azureEmailError");
  }

  if (
    lower.includes("redirect url is not configured") ||
    lower.includes("vite_auth_redirect_url")
  ) {
    return t("settings.redirectNotConfigured");
  }

  return message;
}
