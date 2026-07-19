import { getIsStandaloneDisplay, getPwaPlatform } from "../../lib/pwaPlatform.js";
import { supabase } from "../../lib/supabaseClient.js";
import { normalizeInAppRedirect } from "./safeRedirect.js";

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

export async function waitForPersistedSession({ attempts = 20, delayMs = 100 } = {}) {
  if (!supabase) {
    return null;
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }

    if (data.session) {
      return data.session;
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, delayMs);
    });
  }

  return null;
}

export function navigateAfterAuth(redirectTo) {
  window.location.replace(normalizeInAppRedirect(redirectTo));
}

export function navigateAfterSignOut() {
  window.location.replace("/");
}
