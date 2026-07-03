import { Capacitor } from "@capacitor/core";
import { isIosStandalonePwa } from "./authBootstrap.js";
import { resolveAuthRedirectUrl, getSupabaseRedirectUrlHints } from "./authRedirect.js";
import { getFriendlyNetworkError } from "../../lib/networkErrors.js";
import { isMobileWebBrowser } from "../../lib/pwaPlatform.js";

function extractEmailFromErrorMessage(message) {
  const match = String(message || "").match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return match?.[0]?.toLowerCase() ?? "";
}

export function getFriendlyAuthError(message, t) {
  const offlineFriendly = getFriendlyNetworkError(message, t, "errors.offlineCloudLoad");
  if (offlineFriendly !== message) {
    return offlineFriendly;
  }

  const lower = message.toLowerCase();

  if (
    lower.includes("rate limit") ||
    lower.includes("over_email_send_rate_limit") ||
    lower.includes("over_request_rate_limit")
  ) {
    return t("settings.rateLimit");
  }

  if (lower.includes("quota has been exceeded") || lower.includes("quota exceeded")) {
    return t("settings.authQuotaExceeded");
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
      wildcard: resolveAuthRedirectUrl()
        ? `${resolveAuthRedirectUrl().replace(/\/auth\/callback$/, "")}/**`
        : t("settings.notConfigured"),
    });
  }

  if (lower.includes("signup") || lower.includes("sign ups")) {
    return t("settings.signupsDisabled");
  }

  if (
    lower.includes("user not found") ||
    lower.includes("no user found") ||
    lower.includes("signups not allowed for otp")
  ) {
    return t("auth.emailLoginCreateAccount");
  }

  if (
    lower.includes("token has expired") ||
    lower.includes("otp has expired") ||
    (lower.includes("invalid") && (lower.includes("token") || lower.includes("otp")))
  ) {
    const email = extractEmailFromErrorMessage(message);
    if (email?.endsWith("@gmail.com") || email?.endsWith("@googlemail.com")) {
      return `${t("auth.emailCodeInvalid")} ${t("auth.emailCodeGmailHint")}`;
    }

    return t("auth.emailCodeInvalid");
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

  if (lower.includes("google sign-in is not available in the iphone home screen app")) {
    return t("auth.pwaIosNotice");
  }

  if (
    lower.includes("code verifier not found") ||
    lower.includes("pkce_code_verifier") ||
    (lower.includes("pkce") && lower.includes("storage")) ||
    lower.includes("could not start google sign-in on this device") ||
    (isMobileWebBrowser() && lower.includes("could not complete sign-in"))
  ) {
    if (isIosStandalonePwa()) {
      return t("auth.pkceStorageError");
    }

    if (isMobileWebBrowser()) {
      return t("auth.mobileOAuthError");
    }

    return t("auth.oauthCallbackError");
  }

  if (
    lower.includes("redirect url is not configured") ||
    lower.includes("vite_auth_redirect_url")
  ) {
    return t("settings.redirectNotConfigured");
  }

  return message;
}
