import { getReviewSessionWords } from "../review/reviewHelpers.js";
import {
  loadReviewSessionForWordIds,
  syncReviewSession,
} from "../../lib/reviewSessionStorage.js";

export function ensureReviewSessionWords(words, { mistakesOnly = false, storage } = {}) {
  const currentWordIds = words.map((word) => word.id).filter(Boolean);
  if (loadReviewSessionForWordIds(currentWordIds, storage) || words.length === 0) {
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
  }, storage);
}
