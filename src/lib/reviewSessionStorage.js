const REVIEW_SESSION_STORAGE_KEY = "lexiland.reviewSession.v1";

function shuffleWordIds(wordIds) {
  const nextIds = [...wordIds];

  for (let index = nextIds.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextIds[index], nextIds[swapIndex]] = [nextIds[swapIndex], nextIds[index]];
  }

  return nextIds;
}

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

  const filteredWordIds = wordIds.filter(Boolean);

  storage.setItem(
    REVIEW_SESSION_STORAGE_KEY,
    JSON.stringify({
      gamePlanWordIds: shuffleWordIds(filteredWordIds),
      mistakesOnly,
      startedAt: new Date().toISOString(),
      totalCount,
      wordIds: filteredWordIds,
    }),
  );
}

function persistReviewSession(session, storage = getDefaultStorage()) {
  if (!storage) {
    return;
  }

  storage.setItem(REVIEW_SESSION_STORAGE_KEY, JSON.stringify(session));
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
      gamePlanWordIds: Array.isArray(parsedValue.gamePlanWordIds)
        ? parsedValue.gamePlanWordIds.filter(Boolean)
        : [],
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

export function getReviewSessionEntryOrder(storage = getDefaultStorage()) {
  const session = loadReviewSession(storage);

  if (!session?.wordIds.length) {
    return null;
  }

  return ensureReviewGamePlan(storage);
}

export function ensureReviewGamePlan(storage = getDefaultStorage()) {
  const session = loadReviewSession(storage);

  if (!session?.wordIds.length) {
    return null;
  }

  const activeWordIds = new Set(session.wordIds);
  const currentPlanMatchesSession =
    session.gamePlanWordIds.length === session.wordIds.length &&
    session.gamePlanWordIds.every((wordId) => activeWordIds.has(wordId));

  if (currentPlanMatchesSession) {
    return session.gamePlanWordIds;
  }

  const gamePlanWordIds = shuffleWordIds(session.wordIds);

  persistReviewSession(
    {
      ...session,
      gamePlanWordIds,
    },
    storage,
  );

  return gamePlanWordIds;
}

export function clearReviewSession(storage = getDefaultStorage()) {
  if (!storage) {
    return;
  }

  storage.removeItem(REVIEW_SESSION_STORAGE_KEY);
}
