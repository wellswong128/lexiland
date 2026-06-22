import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { preloadNativeAppId } from "../features/auth/authRedirect.js";
import { hasSupabaseConfig, supabase } from "./supabaseClient.js";

function isAuthCallbackUrl(url) {
  if (!url) {
    return false;
  }

  return (
    url.includes("/auth/callback") ||
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
  }
}

export function initCapacitorAuth() {
  if (!Capacitor.isNativePlatform() || !hasSupabaseConfig || !supabase) {
    return undefined;
  }

  void preloadNativeAppId();

  void App.getLaunchUrl().then((launch) => {
    if (launch?.url && isAuthCallbackUrl(launch.url)) {
      void handleAuthCallbackUrl(launch.url);
    }
  });

  void App.addListener("appUrlOpen", ({ url }) => {
    if (!isAuthCallbackUrl(url)) {
      return;
    }

    void handleAuthCallbackUrl(url);
  });

  return undefined;
}
