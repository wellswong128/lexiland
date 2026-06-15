const REVIEW_SESSION_STORAGE_KEY = "lexiland.reviewSession.v1";

function getDefaultStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function saveReviewSession(
  { mistakesOnly = false, totalCount = 0, wordIds = [] },
  storage = getDefaultStorage(),
) {
  if (!storage) {
    return;
  }

  storage.setItem(
    REVIEW_SESSION_STORAGE_KEY,
    JSON.stringify({
      mistakesOnly,
      startedAt: new Date().toISOString(),
      totalCount,
      wordIds,
    }),
  );
}

export function loadReviewSession(storage = getDefaultStorage()) {
  if (!storage) {
    return null;
  }

  const rawValue = storage.getItem(REVIEW_SESSION_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (!parsedValue || !Array.isArray(parsedValue.wordIds)) {
      return null;
    }

    return {
      mistakesOnly: Boolean(parsedValue.mistakesOnly),
      startedAt: parsedValue.startedAt ?? null,
      totalCount: Number(parsedValue.totalCount) || parsedValue.wordIds.length,
      wordIds: parsedValue.wordIds.filter(Boolean),
    };
  } catch {
    return null;
  }
}

export function getActiveReviewSessionWordIds(storage = getDefaultStorage()) {
  const session = loadReviewSession(storage);

  if (!session?.wordIds.length) {
    return null;
  }

  return new Set(session.wordIds);
}

export function clearReviewSession(storage = getDefaultStorage()) {
  if (!storage) {
    return;
  }

  storage.removeItem(REVIEW_SESSION_STORAGE_KEY);
}
