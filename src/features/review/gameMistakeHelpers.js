import { getCurrentIsoDate, normalizeTerm } from "../words/wordTypes.js";

export const GAME_MISTAKE_THRESHOLD = 2;

export function findWordInLibrary(words, term) {
  const normalizedTerm = normalizeTerm(term);

  if (!normalizedTerm) {
    return null;
  }

  return words.find((word) => normalizeTerm(word.term) === normalizedTerm) ?? null;
}

export function buildGameMistakeUpdate(word, now = getCurrentIsoDate()) {
  return {
    mistake: {
      ...word.mistake,
      isMistake: true,
      lastMistakeAt: now,
      mistakeCount: word.mistake.mistakeCount + 1,
    },
  };
}

export function getTermsEligibleForMistakeBook(wrongCounts, words, threshold = GAME_MISTAKE_THRESHOLD) {
  const eligibleTerms = [];

  for (const [term, count] of Object.entries(wrongCounts)) {
    if (count < threshold) {
      continue;
    }

    const word = findWordInLibrary(words, term);

    if (word) {
      eligibleTerms.push(word.term);
    }
  }

  return eligibleTerms;
}

export function commitGameMistakes({
  wrongCounts,
  words,
  updateWord,
  now = getCurrentIsoDate(),
  threshold = GAME_MISTAKE_THRESHOLD,
}) {
  const addedTerms = [];

  for (const [term, count] of Object.entries(wrongCounts)) {
    if (count < threshold) {
      continue;
    }

    const word = findWordInLibrary(words, term);

    if (!word) {
      continue;
    }

    updateWord(word.id, buildGameMistakeUpdate(word, now));
    addedTerms.push(word.term);
  }

  return addedTerms;
}
