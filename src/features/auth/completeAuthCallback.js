import { supabase, usesAutoSessionDetection } from "../../lib/supabaseClient.js";
import {
  clearPkceVerifierBackup,
  restorePkceVerifierBackup,
} from "./pkceStorage.js";

const POST_AUTH_REDIRECT_KEY = "lexiland.auth.post-login-redirect";

let activeCallbackPromise = null;

function readAuthCallbackError() {
  if (typeof window === "undefined") {
    return "";
  }

  const hashParams = window.location.hash.startsWith("#")
    ? new URLSearchParams(window.location.hash.slice(1))
    : new URLSearchParams();
  const searchParams = new URLSearchParams(window.location.search);

  const rawError =
    hashParams.get("error_description") ||
    hashParams.get("error") ||
    searchParams.get("error_description") ||
    searchParams.get("error");

  if (!rawError) {
    return "";
  }

  return decodeURIComponent(rawError.replace(/\+/g, " "));
}

export function rememberPostAuthRedirect(redirectPath) {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  const normalizedRedirect = String(redirectPath || "").trim();
  if (!normalizedRedirect.startsWith("/")) {
    return;
  }

  try {
    sessionStorage.setItem(POST_AUTH_REDIRECT_KEY, normalizedRedirect);
  } catch {
    // sessionStorage may be unavailable.
  }
}

export function resolvePostAuthRedirect(fallback = "/") {
  if (typeof window === "undefined") {
    return fallback;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const redirectFromUrl = searchParams.get("redirect");

  if (redirectFromUrl?.startsWith("/")) {
    return redirectFromUrl;
  }

  try {
    const storedRedirect = sessionStorage.getItem(POST_AUTH_REDIRECT_KEY);

    if (storedRedirect?.startsWith("/")) {
      return storedRedirect;
    }
  } catch {
    // sessionStorage may be unavailable.
  }

  return fallback;
}

export function clearPostAuthRedirect() {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  try {
    sessionStorage.removeItem(POST_AUTH_REDIRECT_KEY);
  } catch {
    // sessionStorage may be unavailable.
  }
}

export function hasPendingAuthCallback() {
  if (typeof window === "undefined") {
    return false;
  }

  const searchParams = new URLSearchParams(window.location.search);
  return (
    searchParams.has("code") ||
    window.location.hash.includes("access_token=") ||
    Boolean(readAuthCallbackError())
  );
}

export function cleanAuthCallbackUrl() {
  if (typeof window === "undefined") {
    return;
  }

  const { pathname, search, hash } = window.location;
  const searchParams = new URLSearchParams(search);
  searchParams.delete("code");
  searchParams.delete("error");
  searchParams.delete("error_description");
  searchParams.delete("error_code");

  const nextSearch = searchParams.toString();
  const shouldClearHash =
    hash.includes("access_token=") ||
    hash.includes("error=") ||
    hash.includes("error_description=");

  window.history.replaceState(
    {},
    document.title,
    `${pathname}${nextSearch ? `?${nextSearch}` : ""}${shouldClearHash ? "" : hash}`,
  );
}

async function completeAuthCallbackFromUrlInternal() {
  if (!supabase || typeof window === "undefined") {
    return { session: null, error: null, hadCallback: false };
  }

  const callbackError = readAuthCallbackError();
  if (callbackError) {
    cleanAuthCallbackUrl();
    return { session: null, error: new Error(callbackError), hadCallback: true };
  }

  const searchParams = new URLSearchParams(window.location.search);
  const authCode = searchParams.get("code");

  if (authCode) {
    restorePkceVerifierBackup();

    if (usesAutoSessionDetection) {
      const { data, error } = await supabase.auth.getSession();

      if (data?.session) {
        cleanAuthCallbackUrl();
        clearPkceVerifierBackup();
        return { session: data.session, error: null, hadCallback: true };
      }

      restorePkceVerifierBackup();

      const { data: exchangeData, error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(authCode);

      if (exchangeData?.session) {
        cleanAuthCallbackUrl();
        clearPkceVerifierBackup();
        return { session: exchangeData.session, error: null, hadCallback: true };
      }

      const { data: retryData, error: retryError } = await supabase.auth.getSession();

      if (retryData?.session) {
        cleanAuthCallbackUrl();
        clearPkceVerifierBackup();
        return { session: retryData.session, error: null, hadCallback: true };
      }

      cleanAuthCallbackUrl();

      return {
        session: null,
        error: exchangeError ?? retryError ?? error ?? new Error("Could not complete sign-in."),
        hadCallback: true,
      };
    }

    const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);

    if (!error && data?.session) {
      cleanAuthCallbackUrl();
      clearPkceVerifierBackup();
      return { session: data.session, error: null, hadCallback: true };
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionData?.session) {
      cleanAuthCallbackUrl();
      clearPkceVerifierBackup();
      return { session: sessionData.session, error: null, hadCallback: true };
    }

    cleanAuthCallbackUrl();

    return {
      session: null,
      error: error ?? sessionError ?? new Error("Could not complete sign-in."),
      hadCallback: true,
    };
  }

  const { data, error } = await supabase.auth.getSession();
  if (data?.session && window.location.hash.includes("access_token=")) {
    cleanAuthCallbackUrl();
  }

  return {
    session: data?.session ?? null,
    error,
    hadCallback: window.location.hash.includes("access_token="),
  };
}

export async function completeAuthCallbackFromUrl() {
  if (activeCallbackPromise) {
    return activeCallbackPromise;
  }

  activeCallbackPromise = completeAuthCallbackFromUrlInternal().finally(() => {
    activeCallbackPromise = null;
  });

  return activeCallbackPromise;
}
