import { useEffect, useState } from "react";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import {
  fetchLatestAppVersionInfo,
  formatAppVersionLabel,
  getAppVersionLabel,
  hasRemoteVersionUpdate,
} from "../lib/appVersion.js";
import { getIsStandaloneDisplay, getPwaPlatform, getServiceWorkerSupport } from "../lib/pwaPlatform.js";
import { isCapacitorNative } from "../lib/platform.js";
import {
  getNeedsRefresh,
  getOfflineReady,
  getPendingLatestVersion,
  probeNeedsRefresh,
  probeOfflineReady,
} from "../lib/pwaRuntimeState.js";

export function usePwaRuntimeStatus() {
  const { locale } = useLocale();
  const displayLocale = locale === "zh-Hant" ? "zh-Hant" : "en-GB";
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [offlineReady, setOfflineReady] = useState(getOfflineReady);
  const [needsRefresh, setNeedsRefresh] = useState(getNeedsRefresh);
  const [latestVersion, setLatestVersion] = useState(getPendingLatestVersion);
  const [serviceWorkerState, setServiceWorkerState] = useState("checking");
  const currentVersion = getAppVersionLabel(displayLocale);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    function handleOfflineReady() {
      setOfflineReady(true);
    }

    function handleAppUpdateAvailable(event) {
      const version = event?.detail?.latestVersion;

      if (typeof version === "string" && version.trim()) {
        setLatestVersion(version.trim());
      }

      setNeedsRefresh(true);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("lexiland:offline-ready", handleOfflineReady);
    window.addEventListener("lexiland:app-update-available", handleAppUpdateAvailable);

    void probeOfflineReady().then((ready) => {
      if (ready) {
        setOfflineReady(true);
      }
    });

    void probeNeedsRefresh().then((pendingUpdate) => {
      if (pendingUpdate) {
        setNeedsRefresh(true);
      }
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("lexiland:offline-ready", handleOfflineReady);
      window.removeEventListener("lexiland:app-update-available", handleAppUpdateAvailable);
    };
  }, []);

  useEffect(() => {
    if (!needsRefresh || !isOnline || isCapacitorNative()) {
      return undefined;
    }

    let cancelled = false;

    async function loadLatestVersion() {
      const remoteVersion = await fetchLatestAppVersionInfo();

      if (!cancelled && remoteVersion && hasRemoteVersionUpdate(remoteVersion.build)) {
        setLatestVersion(
          formatAppVersionLabel(
            { semver: remoteVersion.semver, builtAt: remoteVersion.builtAt, build: remoteVersion.build },
            displayLocale,
          ),
        );
      }
    }

    void loadLatestVersion();

    return () => {
      cancelled = true;
    };
  }, [displayLocale, isOnline, needsRefresh]);

  useEffect(() => {
    if (isCapacitorNative()) {
      setServiceWorkerState("native");
      return undefined;
    }

    if (!getServiceWorkerSupport()) {
      setServiceWorkerState("unsupported");
      return undefined;
    }

    let cancelled = false;

    async function syncServiceWorkerState() {
      try {
        const registration = await navigator.serviceWorker.ready;

        if (cancelled) {
          return;
        }

        if (registration.active) {
          setServiceWorkerState("active");
          return;
        }

        if (registration.installing || registration.waiting) {
          setServiceWorkerState("installing");
          return;
        }

        setServiceWorkerState("none");
      } catch {
        if (!cancelled) {
          setServiceWorkerState("error");
        }
      }
    }

    if (navigator.serviceWorker.controller) {
      setServiceWorkerState("active");
    } else {
      setServiceWorkerState("installing");
    }

    void syncServiceWorkerState();

    function handleControllerChange() {
      setServiceWorkerState(navigator.serviceWorker.controller ? "active" : "none");
    }

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  return {
    currentVersion,
    isInstalled: getIsStandaloneDisplay(),
    isOnline,
    latestVersion,
    needsRefresh,
    offlineReady,
    platform: getPwaPlatform(),
    serviceWorkerState,
    serviceWorkerSupported: getServiceWorkerSupport(),
  };
}
