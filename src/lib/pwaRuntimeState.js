const OFFLINE_READY_STORAGE_KEY = "lexiland.pwa.offlineReady";

let offlineReady = readStoredOfflineReady();
let needsRefresh = false;

function readStoredOfflineReady() {
  if (typeof localStorage === "undefined") {
    return false;
  }

  try {
    return localStorage.getItem(OFFLINE_READY_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistOfflineReady(value) {
  offlineReady = value;

  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    if (value) {
      localStorage.setItem(OFFLINE_READY_STORAGE_KEY, "1");
    } else {
      localStorage.removeItem(OFFLINE_READY_STORAGE_KEY);
    }
  } catch {
    // Ignore private browsing / storage quota errors.
  }
}

export function markOfflineReady() {
  persistOfflineReady(true);
}

export function getOfflineReady() {
  return offlineReady;
}

export function markNeedsRefresh() {
  needsRefresh = true;
}

export function getNeedsRefresh() {
  return needsRefresh;
}

export async function probeOfflineReady() {
  if (offlineReady) {
    return true;
  }

  if (!("serviceWorker" in navigator) || !("caches" in window)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    if (!registration.active && !navigator.serviceWorker.controller) {
      return false;
    }

    const cacheNames = await caches.keys();

    for (const cacheName of cacheNames) {
      if (!/precache|workbox/i.test(cacheName)) {
        continue;
      }

      const cache = await caches.open(cacheName);
      const entries = await cache.keys();

      if (entries.length > 0) {
        persistOfflineReady(true);
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}
