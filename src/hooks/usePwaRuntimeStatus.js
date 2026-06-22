import { useEffect, useState } from "react";
import { getIsStandaloneDisplay, getPwaPlatform, getServiceWorkerSupport } from "../lib/pwaPlatform.js";
import {
  getNeedsRefresh,
  getOfflineReady,
  probeOfflineReady,
} from "../lib/pwaRuntimeState.js";

export function usePwaRuntimeStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [offlineReady, setOfflineReady] = useState(getOfflineReady);
  const [needsRefresh, setNeedsRefresh] = useState(getNeedsRefresh);
  const [serviceWorkerState, setServiceWorkerState] = useState("checking");

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

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("lexiland:offline-ready", handleOfflineReady);
      window.removeEventListener("lexiland:sw-needs-refresh", handleNeedsRefresh);
    };
  }, []);

  useEffect(() => {
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
    isInstalled: getIsStandaloneDisplay(),
    isOnline,
    needsRefresh,
    offlineReady,
    platform: getPwaPlatform(),
    serviceWorkerState,
    serviceWorkerSupported: getServiceWorkerSupport(),
  };
}
