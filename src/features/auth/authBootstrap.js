import { getIsStandaloneDisplay, getPwaPlatform } from "../../lib/pwaPlatform.js";
import { supabase } from "../../lib/supabaseClient.js";

const IOS_STANDALONE_OAUTH_FLAG = "lexiland.auth.ios-standalone-oauth";

export function isIosStandalonePwa() {
  return getPwaPlatform() === "ios" && getIsStandaloneDisplay();
}

export function markIosStandaloneOAuthStart() {
  if (!isIosStandalonePwa() || typeof sessionStorage === "undefined") {
    return;
  }

  try {
    sessionStorage.setItem(IOS_STANDALONE_OAUTH_FLAG, String(Date.now()));
  } catch {
    // sessionStorage may be unavailable.
  }
}

export function consumeIosStandaloneOAuthStart() {
  if (typeof sessionStorage === "undefined") {
    return false;
  }

  try {
    const value = sessionStorage.getItem(IOS_STANDALONE_OAUTH_FLAG);
    sessionStorage.removeItem(IOS_STANDALONE_OAUTH_FLAG);
    return Boolean(value);
  } catch {
    return false;
  }
}

export function shouldHardNavigateAfterAuth() {
  return isIosStandalonePwa();
}

function delay(delayMs) {
  const timeout = typeof window === "undefined" ? globalThis.setTimeout : window.setTimeout;

  return new Promise((resolve) => {
    timeout(resolve, delayMs);
  });
}

export async function waitForPersistedSession({
  attempts = 20,
  delayMs = 100,
  authClient = supabase?.auth,
} = {}) {
  if (!authClient) {
    return null;
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { data, error } = await authClient.getSession();
    if (error) {
      throw error;
    }

    if (data.session) {
      return data.session;
    }

    await delay(delayMs);
  }

  return null;
}

export function getSafeAuthRedirectPath(redirectTo) {
  if (typeof redirectTo !== "string") {
    return "/";
  }

  const safeRedirect = redirectTo.trim();

  if (
    !safeRedirect.startsWith("/") ||
    safeRedirect.startsWith("//") ||
    safeRedirect.startsWith("/\\")
  ) {
    return "/";
  }

  return safeRedirect;
}

export function navigateAfterAuth(redirectTo) {
  const safeRedirect = getSafeAuthRedirectPath(redirectTo);
  window.location.replace(safeRedirect);
}

export async function navigateAfterPersistedSession(redirectTo, options) {
  const persistedSession = await waitForPersistedSession(options);

  if (!persistedSession) {
    return false;
  }

  navigateAfterAuth(redirectTo);
  return true;
}
