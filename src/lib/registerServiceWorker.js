import { markNeedsRefresh, markOfflineReady, setUpdateServiceWorker } from "./pwaRuntimeState.js";
import { isCapacitorNative } from "./platform.js";

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator) || isCapacitorNative()) {
    return;
  }

  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      const updateSW = registerSW({
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

      setUpdateServiceWorker(updateSW);
    })
    .catch((error) => {
      console.warn("Could not load service worker registration.", error);
    });
}
