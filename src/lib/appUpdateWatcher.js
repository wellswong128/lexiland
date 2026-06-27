import {
  fetchLatestAppVersion,
  getAppVersion,
  hasRemoteVersionUpdate,
} from "./appVersion.js";
import { isCapacitorNative } from "./platform.js";
import { markNeedsRefresh } from "./pwaRuntimeState.js";

const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Compare the bundled app version with /version.json on the server.
 * Returns whether a newer deployment is available.
 */
export async function checkForAppUpdate() {
  const currentVersion = getAppVersion();
  const latestVersion = await fetchLatestAppVersion();

  if (!latestVersion || !hasRemoteVersionUpdate(latestVersion)) {
    return {
      currentVersion,
      hasUpdate: false,
      latestVersion,
    };
  }

  return {
    currentVersion,
    hasUpdate: true,
    latestVersion,
  };
}

async function promptServiceWorkerUpdateCheck() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  } catch {
    // Ignore transient SW update errors.
  }
}

/**
 * Mark the app as needing refresh and notify listeners (UpdateBanner, settings panel, etc.).
 */
export function notifyAppUpdateAvailable(latestVersion) {
  markNeedsRefresh();

  window.dispatchEvent(
    new CustomEvent("lexiland:app-update-available", {
      detail: { latestVersion: latestVersion || null },
    }),
  );

  // Backward compatibility with existing service-worker listeners.
  window.dispatchEvent(new CustomEvent("lexiland:sw-needs-refresh"));
}

/**
 * Poll the server for new deployments and re-check when the user returns to the app.
 * Returns a cleanup function.
 */
export function startAppUpdateWatcher({
  intervalMs = DEFAULT_POLL_INTERVAL_MS,
  enabled = import.meta.env.PROD,
} = {}) {
  if (!enabled || typeof window === "undefined" || isCapacitorNative()) {
    return () => {};
  }

  let cancelled = false;

  async function runCheck() {
    if (cancelled || !navigator.onLine) {
      return null;
    }

    const result = await checkForAppUpdate();

    if (result?.hasUpdate) {
      notifyAppUpdateAvailable(result.latestVersion);
      void promptServiceWorkerUpdateCheck();
    }

    return result;
  }

  void runCheck();

  const intervalId = window.setInterval(() => {
    void runCheck();
  }, intervalMs);

  function handleVisibleAgain() {
    if (document.visibilityState === "visible") {
      void runCheck();
    }
  }

  function handleOnline() {
    void runCheck();
  }

  document.addEventListener("visibilitychange", handleVisibleAgain);
  window.addEventListener("focus", handleVisibleAgain);
  window.addEventListener("online", handleOnline);

  return () => {
    cancelled = true;
    window.clearInterval(intervalId);
    document.removeEventListener("visibilitychange", handleVisibleAgain);
    window.removeEventListener("focus", handleVisibleAgain);
    window.removeEventListener("online", handleOnline);
  };
}
