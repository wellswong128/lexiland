import { REVIEW_RESULTS } from "../words/wordTypes.js";

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

  return words.filter(
    (word) => word.mistake?.isMistake || dueWordIds.has(word.id),
  );
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

export function updateReviewResult(word, result, now = new Date()) {
  const remembered =
    result === REVIEW_RESULTS.REMEMBERED || result === REVIEW_RESULTS.CORRECT;
  const nextLevel = remembered ? word.review.level + 1 : 0;

  return {
    review: {
      ...word.review,
      level: nextLevel,
      nextReviewAt: getNextReviewAt(nextLevel, now),
      lastReviewedAt: now.toISOString(),
      correctCount: word.review.correctCount + (remembered ? 1 : 0),
      incorrectCount: word.review.incorrectCount + (remembered ? 0 : 1),
      lastResult: result,
    },
    mistake: remembered
      ? word.mistake
      : {
          ...word.mistake,
          isMistake: true,
          lastMistakeAt: now.toISOString(),
          mistakeCount: word.mistake.mistakeCount + 1,
        },
  };
}
