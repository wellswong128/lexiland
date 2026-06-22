import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { getNativeAuthRedirectUrl } from "../features/auth/authRedirect.js";
import { hasSupabaseConfig, supabase } from "./supabaseClient.js";

function isAuthCallbackUrl(url) {
  if (!url) {
    return false;
  }

  const nativeRedirect = getNativeAuthRedirectUrl();
  const nativeScheme = nativeRedirect.split("://")[0];

  return (
    url.startsWith(nativeRedirect) ||
    url.startsWith(`${nativeScheme}://`) ||
    url.startsWith("capacitor://") ||
    url.startsWith("ionic://") ||
    url.includes("auth/callback") ||
    url.includes("code=") ||
    url.includes("access_token=")
  );
}

async function handleAuthCallbackUrl(url) {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.auth.exchangeCodeForSession(url);

  if (error) {
    console.warn("Could not complete native auth callback.", error);
    return;
  }

  try {
    await Browser.close();
  } catch {
    // Browser may already be closed.
  }
}

export function initCapacitorAuth() {
  if (!Capacitor.isNativePlatform() || !hasSupabaseConfig || !supabase) {
    return undefined;
  }

  void App.addListener("appUrlOpen", ({ url }) => {
    if (!isAuthCallbackUrl(url)) {
      return;
    }

    void handleAuthCallbackUrl(url);
  });

  return undefined;
}

export async function openNativeOAuthUrl(url) {
  await Browser.open({ url, presentationStyle: "popover" });
}
