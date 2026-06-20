function getStorageKey(userId) {
  return userId ? `lexiland.activeGroupScope.${userId}` : "lexiland.activeGroupScope";
}

export function loadCachedActiveGroupScope(userId) {
  if (typeof window === "undefined" || !userId) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      activeGroup: parsed.activeGroup ?? null,
      mappedTerms: Array.isArray(parsed.mappedTerms) ? parsed.mappedTerms : [],
    };
  } catch {
    return null;
  }
}

export function saveCachedActiveGroupScope(userId, { activeGroup, mappedTerms }) {
  if (typeof window === "undefined" || !userId) {
    return;
  }

  if (!activeGroup) {
    window.localStorage.removeItem(getStorageKey(userId));
    return;
  }

  window.localStorage.setItem(
    getStorageKey(userId),
    JSON.stringify({
      activeGroup,
      mappedTerms: Array.isArray(mappedTerms) ? mappedTerms : [],
    }),
  );
}

export function clearCachedActiveGroupScope(userId) {
  if (typeof window === "undefined" || !userId) {
    return;
  }

  window.localStorage.removeItem(getStorageKey(userId));
}
