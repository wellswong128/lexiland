import {
  fetchLatestAppVersionInfo,
  formatAppVersionLabel,
  getAppVersion,
  getAppVersionLabel,
  hasRemoteVersionUpdate,
} from "./appVersion.js";
import { isCapacitorNative } from "./platform.js";
import { markNeedsRefresh } from "./pwaRuntimeState.js";

const DEFAULT_POLL_INTERVAL_MS = 60 * 1000;
const INITIAL_CHECK_DELAY_MS = 250;

/**
 * Compare the bundled app version with /version.json on the server.
 * Returns whether a newer deployment is available.
 */
export async function checkForAppUpdate() {
  const currentVersion = getAppVersionLabel();
  const currentBuild = getAppVersion();
  const latestInfo = await fetchLatestAppVersionInfo();

  if (!latestInfo || !hasRemoteVersionUpdate(latestInfo.build)) {
    return {
      currentBuild,
      currentVersion,
      hasUpdate: false,
      latestBuild: latestInfo?.build ?? null,
      latestVersion: latestInfo
        ? formatAppVersionLabel({ semver: latestInfo.semver, builtAt: latestInfo.builtAt, build: latestInfo.build })
        : null,
    };
  }

  return {
    currentBuild,
    currentVersion,
    hasUpdate: true,
    latestBuild: latestInfo.build,
    latestVersion: formatAppVersionLabel({
      semver: latestInfo.semver,
      builtAt: latestInfo.builtAt,
      build: latestInfo.build,
    }),
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
export function notifyAppUpdateAvailable(latestVersionLabel) {
  markNeedsRefresh();

  window.dispatchEvent(
    new CustomEvent("lexiland:app-update-available", {
      detail: { latestVersion: latestVersionLabel || null },
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

  const initialCheckId = window.setTimeout(() => {
    void runCheck();
  }, INITIAL_CHECK_DELAY_MS);

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
    window.clearTimeout(initialCheckId);
    window.clearInterval(intervalId);
    document.removeEventListener("visibilitychange", handleVisibleAgain);
    window.removeEventListener("focus", handleVisibleAgain);
    window.removeEventListener("online", handleOnline);
  };
}
