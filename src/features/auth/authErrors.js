import { Capacitor } from "@capacitor/core";
import { resolveAuthRedirectUrl, getSupabaseRedirectUrlHints } from "./authRedirect.js";
import { getFriendlyNetworkError } from "../../lib/networkErrors.js";

export function getFriendlyAuthError(message, t) {
  const offlineFriendly = getFriendlyNetworkError(message, t, "errors.offlineCloudLoad");
  if (offlineFriendly !== message) {
    return offlineFriendly;
  }

  const lower = message.toLowerCase();

  if (lower.includes("rate limit")) {
    return t("settings.rateLimit");
  }

  if (
    lower.includes("redirect") ||
    lower.includes("url configuration") ||
    lower.includes("invalid url")
  ) {
    if (Capacitor.isNativePlatform()) {
      const hints = getSupabaseRedirectUrlHints();
      return t("settings.redirectUrlErrorNative", {
        url: resolveAuthRedirectUrl() || hints[0],
        hints: hints.join("\n"),
      });
    }

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
    lower.includes("error getting user profile from external provider")
  ) {
    return t("settings.oauthEmailError");
  }

  if (
    lower.includes("redirect url is not configured") ||
    lower.includes("vite_auth_redirect_url")
  ) {
    return t("settings.redirectNotConfigured");
  }

  return message;
}
