export const ACTIVE_STORAGE_USER_KEY = "lexiland.activeUserId.v1";

function getDefaultStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function normalizeUserId(userId) {
  const normalized = String(userId || "").trim();
  return normalized || null;
}

export function getActiveStorageUserId(storage = getDefaultStorage()) {
  if (!storage) {
    return null;
  }

  return normalizeUserId(storage.getItem(ACTIVE_STORAGE_USER_KEY));
}

export function setActiveStorageUserId(userId, storage = getDefaultStorage()) {
  if (!storage) {
    return;
  }

  const normalizedUserId = normalizeUserId(userId);

  if (normalizedUserId) {
    storage.setItem(ACTIVE_STORAGE_USER_KEY, normalizedUserId);
  } else {
    storage.removeItem(ACTIVE_STORAGE_USER_KEY);
  }
}

export function clearActiveStorageUserId(storage = getDefaultStorage()) {
  if (!storage) {
    return;
  }

  storage.removeItem(ACTIVE_STORAGE_USER_KEY);
}

export function getScopedStorageKey(baseKey, userId = null) {
  const normalizedUserId = normalizeUserId(userId);

  if (!normalizedUserId) {
    return baseKey;
  }

  return `${baseKey}.${encodeURIComponent(normalizedUserId)}`;
}
