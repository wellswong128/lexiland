import { markNeedsRefresh, markOfflineReady } from "./pwaRuntimeState.js";

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return;
  }

  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onNeedRefresh() {
          markNeedsRefresh();
          window.dispatchEvent(new CustomEvent("lexiland:sw-needs-refresh"));
        },
        onOfflineReady() {
          markOfflineReady();
          window.dispatchEvent(new CustomEvent("lexiland:offline-ready"));
        },
        onRegistered(registration) {
          if (!registration) {
            return;
          }

          window.dispatchEvent(
            new CustomEvent("lexiland:sw-registered", {
              detail: { scope: registration.scope },
            }),
          );
        },
        onRegisterError(error) {
          console.warn("Service worker registration failed.", error);
          window.dispatchEvent(
            new CustomEvent("lexiland:sw-register-error", {
              detail: { message: error?.message || "Registration failed." },
            }),
          );
        },
      });
    })
    .catch((error) => {
      console.warn("Could not load service worker registration.", error);
    });
}
