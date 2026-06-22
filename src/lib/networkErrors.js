const OFFLINE_NETWORK_PATTERNS = [
  "load failed",
  "failed to fetch",
  "networkerror",
  "network request failed",
  "the internet connection appears to be offline",
  "network connection was lost",
  "fetch failed",
];

export function isOfflineNetworkError(message) {
  if (!message) {
    return false;
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return true;
  }

  const lower = String(message).toLowerCase();
  return OFFLINE_NETWORK_PATTERNS.some((pattern) => lower.includes(pattern));
}

export function getFriendlyNetworkError(message, t, offlineMessageKey) {
  if (!isOfflineNetworkError(message)) {
    return message;
  }

  return t(offlineMessageKey);
}
