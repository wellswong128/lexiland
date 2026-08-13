import { getReviewSessionWords } from "../review/reviewHelpers.js";
import {
  clearReviewSession,
  hasActiveReviewSession,
  loadReviewSession,
  syncReviewSession,
} from "../../lib/reviewSessionStorage.js";

function sessionBelongsToWords(session, words) {
  if (!session?.wordIds.length) {
    return false;
  }

  const currentWordIds = new Set(words.map((word) => word.id).filter(Boolean));
  return session.wordIds.every((wordId) => currentWordIds.has(wordId));
}

export function ensureReviewSessionWords(words, { mistakesOnly = false, storage } = {}) {
  const activeSession = loadReviewSession(storage);
  if (activeSession?.wordIds.length) {
    if (sessionBelongsToWords(activeSession, words)) {
      return;
    }

    clearReviewSession(storage);
  }

  if (hasActiveReviewSession(storage) || words.length === 0) {
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
