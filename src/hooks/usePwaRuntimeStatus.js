import { useEffect, useState } from "react";
import { fetchLatestAppVersion, getAppVersion, hasRemoteVersionUpdate } from "../lib/appVersion.js";
import { getIsStandaloneDisplay, getPwaPlatform, getServiceWorkerSupport } from "../lib/pwaPlatform.js";
import { isCapacitorNative } from "../lib/platform.js";
import {
  getNeedsRefresh,
  getOfflineReady,
  probeNeedsRefresh,
  probeOfflineReady,
} from "../lib/pwaRuntimeState.js";

export function usePwaRuntimeStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [offlineReady, setOfflineReady] = useState(getOfflineReady);
  const [needsRefresh, setNeedsRefresh] = useState(getNeedsRefresh);
  const [latestVersion, setLatestVersion] = useState(null);
  const [serviceWorkerState, setServiceWorkerState] = useState("checking");
  const currentVersion = getAppVersion();

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

    function handleNeedsRefresh() {
      setNeedsRefresh(true);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("lexiland:offline-ready", handleOfflineReady);
    window.addEventListener("lexiland:sw-needs-refresh", handleNeedsRefresh);

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
      window.removeEventListener("lexiland:sw-needs-refresh", handleNeedsRefresh);
    };
  }, []);

  useEffect(() => {
    if (!isOnline || isCapacitorNative()) {
      return undefined;
    }

    let cancelled = false;

    async function syncLatestVersion() {
      const remoteVersion = await fetchLatestAppVersion();

      if (cancelled || !remoteVersion) {
        return;
      }

      if (hasRemoteVersionUpdate(remoteVersion)) {
        setLatestVersion(remoteVersion);

        const pendingUpdate = await probeNeedsRefresh();
        if (!cancelled && pendingUpdate) {
          setNeedsRefresh(true);
        }
      }
    }

    void syncLatestVersion();

    return () => {
      cancelled = true;
    };
  }, [isOnline]);

  useEffect(() => {
    if (!needsRefresh || !isOnline || isCapacitorNative()) {
      return undefined;
    }

    let cancelled = false;

    async function loadLatestVersion() {
      const remoteVersion = await fetchLatestAppVersion();

      if (!cancelled && remoteVersion && hasRemoteVersionUpdate(remoteVersion)) {
        setLatestVersion(remoteVersion);
      }
    }

    void loadLatestVersion();

    return () => {
      cancelled = true;
    };
  }, [isOnline, needsRefresh]);

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
