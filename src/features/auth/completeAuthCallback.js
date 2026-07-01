import { supabase } from "../../lib/supabaseClient.js";

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

export async function completeAuthCallbackFromUrl() {
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
    const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);

    if (!error && data?.session) {
      cleanAuthCallbackUrl();
      return { session: data.session, error: null, hadCallback: true };
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionData?.session) {
      cleanAuthCallbackUrl();
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
