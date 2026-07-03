import { createGoogleNoncePair } from "./googleNonce.js";

const GOOGLE_GSI_URL = "https://accounts.google.com/gsi/client";

let loadPromise = null;

export function getGoogleClientId() {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || "";
}

export function canUseGoogleIdentity() {
  return Boolean(getGoogleClientId()) && typeof window !== "undefined";
}

export function loadGoogleIdentityScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google sign-in is only available in the browser."));
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${GOOGLE_GSI_URL}"]`);

      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Could not load Google sign-in.")),
          { once: true },
        );
        return;
      }

      const script = document.createElement("script");
      script.src = GOOGLE_GSI_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Could not load Google sign-in."));
      document.head.appendChild(script);
    });
  }

  return loadPromise;
}

export async function requestGoogleIdToken() {
  const clientId = getGoogleClientId();

  if (!clientId) {
    throw new Error("Google sign-in is not configured.");
  }

  await loadGoogleIdentityScript();

  const { rawNonce, hashedNonce } = await createGoogleNoncePair();

  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (handler) => {
      if (settled) {
        return;
      }

      settled = true;
      handler();
    };

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (!response?.credential) {
          finish(() => reject(new Error("Google sign-in was cancelled.")));
          return;
        }

        finish(() => resolve({ idToken: response.credential, nonce: rawNonce }));
      },
      nonce: hashedNonce,
      ux_mode: "popup",
      auto_select: false,
      context: "signin",
      itp_support: true,
    });

    window.google.accounts.id.prompt((notification) => {
      if (settled) {
        return;
      }

      if (notification.isNotDisplayed()) {
        const reason = notification.getNotDisplayedReason?.() || "unknown";
        finish(() =>
          reject(
            new Error(
              reason === "browser_not_supported"
                ? "Google sign-in is not supported in this browser."
                : "Google sign-in is unavailable right now. Try again or use email code.",
            ),
          ),
        );
        return;
      }

      if (notification.isSkippedMoment()) {
        finish(() => reject(new Error("Google sign-in was cancelled.")));
      }
    });
  });
}
