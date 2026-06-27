const OFFLINE_READY_STORAGE_KEY = "lexiland.pwa.offlineReady";
const NEEDS_REFRESH_STORAGE_KEY = "lexiland.pwa.needsRefresh";

let offlineReady = readStoredOfflineReady();
let needsRefresh = readStoredNeedsRefresh();
let updateServiceWorker = null;

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

function readStoredNeedsRefresh() {
  if (typeof localStorage === "undefined") {
    return false;
  }

  try {
    return localStorage.getItem(NEEDS_REFRESH_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistNeedsRefresh(value) {
  needsRefresh = value;

  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    if (value) {
      localStorage.setItem(NEEDS_REFRESH_STORAGE_KEY, "1");
    } else {
      localStorage.removeItem(NEEDS_REFRESH_STORAGE_KEY);
    }
  } catch {
    // Ignore private browsing / storage quota errors.
  }
}

export function markNeedsRefresh() {
  persistNeedsRefresh(true);
}

export function clearNeedsRefresh() {
  persistNeedsRefresh(false);
}

export function getNeedsRefresh() {
  return needsRefresh;
}

export function setUpdateServiceWorker(updateFn) {
  updateServiceWorker = updateFn;
}

export async function applyServiceWorkerUpdate() {
  clearNeedsRefresh();

  // Clear all service worker caches so the page loads fresh content
  if (typeof caches !== "undefined") {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    } catch {
      // Ignore cache errors.
    }
  }

  // Unregister the service worker so it re-registers with new precache
  if ("serviceWorker" in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));
    } catch {
      // Ignore unregister errors.
    }
  }

  // Always reload to pick up the new version
  if (typeof window !== "undefined") {
    window.location.reload();
  }
}

export async function probeNeedsRefresh() {
  if (needsRefresh) {
    return true;
  }

  if (!("serviceWorker" in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();

    if (registration?.waiting) {
      markNeedsRefresh();
      return true;
    }
  } catch {
    return false;
  }

  return false;
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
