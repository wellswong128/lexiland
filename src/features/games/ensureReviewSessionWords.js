import {
  getReviewSessionWords,
} from "../review/reviewHelpers.js";
import {
  hasActiveReviewSession,
  syncReviewSession,
} from "../../lib/reviewSessionStorage.js";

export function ensureReviewSessionWords(words, { mistakesOnly = false } = {}) {
  if (hasActiveReviewSession() || words.length === 0) {
    return;
  }

  const { sessionWords, totalCount } = getReviewSessionWords(words, { mistakesOnly });

  if (sessionWords.length === 0) {
    return;
  }

  syncReviewSession({
    mistakesOnly,
    totalCount,
    wordIds: sessionWords.map((word) => word.id),
  });
}
