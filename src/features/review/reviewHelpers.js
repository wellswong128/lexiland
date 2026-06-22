import { createInitialMistake, createInitialReview, REVIEW_RESULTS } from "../words/wordTypes.js";

export const REVIEW_INTERVAL_DAYS_BY_LEVEL = {
  0: 1,
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30,
};

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate.toISOString();
}

export const REVIEW_SESSION_WORD_LIMIT = 10;

export function getDueWords(words, now = new Date()) {
  return words.filter((word) => {
    const nextReviewAt = word.review?.nextReviewAt;

    if (!nextReviewAt) {
      return true;
    }

    return new Date(nextReviewAt) <= now;
  });
}

export function getReviewSessionWords(words, { mistakesOnly = false, now = new Date() } = {}) {
  const allWords = mistakesOnly
    ? words.filter((word) => word.mistake.isMistake)
    : getDueWords(words, now);

  return {
    allWords,
    isLimited: allWords.length > REVIEW_SESSION_WORD_LIMIT,
    sessionWords: allWords.slice(0, REVIEW_SESSION_WORD_LIMIT),
    totalCount: allWords.length,
  };
}

export function getPriorityReviewWords(words, now = new Date()) {
  const dueWordIds = new Set(getDueWords(words, now).map((word) => word.id));

  return words
    .filter((word) => word.mistake?.isMistake || dueWordIds.has(word.id))
    .sort((left, right) => compareGamePriorityWords(left, right));
}

function compareGamePriorityWords(left, right) {
  const leftIsMistake = Boolean(left.mistake?.isMistake);
  const rightIsMistake = Boolean(right.mistake?.isMistake);

  if (leftIsMistake !== rightIsMistake) {
    return leftIsMistake ? -1 : 1;
  }

  if (leftIsMistake && rightIsMistake) {
    const leftMistakeAt = left.mistake?.lastMistakeAt
      ? new Date(left.mistake.lastMistakeAt).getTime()
      : 0;
    const rightMistakeAt = right.mistake?.lastMistakeAt
      ? new Date(right.mistake.lastMistakeAt).getTime()
      : 0;

    return rightMistakeAt - leftMistakeAt;
  }

  const leftDueAt = left.review?.nextReviewAt
    ? new Date(left.review.nextReviewAt).getTime()
    : 0;
  const rightDueAt = right.review?.nextReviewAt
    ? new Date(right.review.nextReviewAt).getTime()
    : 0;

  return leftDueAt - rightDueAt;
}

export function getMaintenanceScore(word, now = new Date()) {
  const nowMs = now.getTime();
  const lastReviewedAt = word.review?.lastReviewedAt;
  const daysSinceReview = lastReviewedAt
    ? (nowMs - new Date(lastReviewedAt).getTime()) / 86_400_000
    : 30;
  const level = word.review?.level ?? 0;
  const levelScore = Math.max(0, 5 - Math.min(level, 5)) * 3;
  const createdAt = word.createdAt ? new Date(word.createdAt).getTime() : nowMs;
  const daysSinceCreated = (nowMs - createdAt) / 86_400_000;
  const recentAddScore = daysSinceCreated <= 14 && lastReviewedAt ? 5 : 0;

  return daysSinceReview * 2 + levelScore + recentAddScore;
}

export function getMaintenanceReviewWords(words, now = new Date()) {
  return [...words].sort(
    (left, right) => getMaintenanceScore(right, now) - getMaintenanceScore(left, now),
  );
}

export function getLimitedMaintenanceReviewWords(words, now = new Date()) {
  const allWords = getMaintenanceReviewWords(words, now);

  return {
    allWords,
    isLimited: allWords.length > REVIEW_SESSION_WORD_LIMIT,
    sessionWords: allWords.slice(0, REVIEW_SESSION_WORD_LIMIT),
    totalCount: allWords.length,
  };
}

export function getLimitedPriorityReviewWords(words, now = new Date()) {
  const allWords = getPriorityReviewWords(words, now);

  return {
    allWords,
    isLimited: allWords.length > REVIEW_SESSION_WORD_LIMIT,
    sessionWords: allWords.slice(0, REVIEW_SESSION_WORD_LIMIT),
    totalCount: allWords.length,
  };
}

export function getNextReviewAt(level, now = new Date()) {
  const intervalLevel = Math.min(level, 5);
  const intervalDays = REVIEW_INTERVAL_DAYS_BY_LEVEL[intervalLevel];

  return addDays(now, intervalDays);
}

export function getReviewIntervalDays(level) {
  return REVIEW_INTERVAL_DAYS_BY_LEVEL[Math.min(level, 5)];
}

export function updateReviewResult(word, result, now = new Date()) {
  const remembered =
    result === REVIEW_RESULTS.REMEMBERED || result === REVIEW_RESULTS.CORRECT;
  const review = {
    ...createInitialReview(now.toISOString()),
    ...word.review,
  };
  const mistake = {
    ...createInitialMistake(),
    ...word.mistake,
  };
  const nextLevel = remembered ? review.level + 1 : 0;

  return {
    review: {
      ...review,
      level: nextLevel,
      nextReviewAt: getNextReviewAt(nextLevel, now),
      lastReviewedAt: now.toISOString(),
      correctCount: review.correctCount + (remembered ? 1 : 0),
      incorrectCount: review.incorrectCount + (remembered ? 0 : 1),
      lastResult: result,
    },
    mistake: remembered
      ? {
          ...mistake,
          isMistake: false,
        }
      : {
          ...mistake,
          isMistake: true,
          lastMistakeAt: now.toISOString(),
          mistakeCount: mistake.mistakeCount + 1,
        },
  };
}
