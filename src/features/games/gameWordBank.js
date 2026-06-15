import { getReviewSessionEntryOrder } from "../../lib/reviewSessionStorage.js";
import { getLimitedPriorityReviewWords } from "../review/reviewHelpers.js";

export const GAME_FALLBACK_WORDS = [
  { word: "apple", meaning: "蘋果", type: "noun" },
  { word: "school", meaning: "學校", type: "noun" },
  { word: "friend", meaning: "朋友", type: "noun" },
  { word: "protect", meaning: "保護", type: "verb" },
  { word: "future", meaning: "未來", type: "noun" },
  { word: "simple", meaning: "簡單的", type: "adj" },
  { word: "planet", meaning: "行星", type: "noun" },
  { word: "challenge", meaning: "挑戰", type: "noun / verb" },
  { word: "beautiful", meaning: "美麗的", type: "adj" },
  { word: "dangerous", meaning: "危險的", type: "adj" },
  { word: "important", meaning: "重要的", type: "adj" },
  { word: "discover", meaning: "發現", type: "verb" },
  { word: "memory", meaning: "記憶", type: "noun" },
  { word: "journey", meaning: "旅程", type: "noun" },
  { word: "solution", meaning: "解決方法", type: "noun" },
  { word: "teacher", meaning: "老師", type: "noun" },
  { word: "student", meaning: "學生", type: "noun" },
  { word: "happy", meaning: "開心", type: "adj" },
];

export const PRIORITY_PICK_CHANCE = 0.75;

export function normalizeGameWord(term) {
  return String(term ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

export function shuffleArray(array) {
  const nextArray = [...array];

  for (let index = nextArray.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextArray[index], nextArray[swapIndex]] = [nextArray[swapIndex], nextArray[index]];
  }

  return nextArray;
}

export function toGameEntry(word, { normalizeWord = (term) => term.trim().toLowerCase() } = {}) {
  const gameWord = normalizeWord(word.term);
  const meaning = (word.translation || word.definition || "").trim();

  if (!gameWord || !meaning) {
    return null;
  }

  return {
    wordId: word.id,
    word: gameWord,
    meaning,
    type: word.partOfSpeech || "word",
  };
}

export function getPriorityWordIds(words, now = new Date()) {
  return new Set(
    getLimitedPriorityReviewWords(words, now).sessionWords.map((word) => word.id),
  );
}

function orderEntriesByWordIds(entries, wordIds) {
  if (!wordIds?.length) {
    return entries;
  }

  const entriesById = new Map(
    entries.filter((entry) => entry.wordId).map((entry) => [entry.wordId, entry]),
  );

  return wordIds.map((wordId) => entriesById.get(wordId)).filter(Boolean);
}

export function buildGameWordBank(
  words,
  {
    minWords = 4,
    minLength = 1,
    normalizeWord = (term) => term.trim().toLowerCase(),
  } = {},
) {
  const reviewSessionWordIds = getReviewSessionEntryOrder();
  const reviewSessionIdSet =
    reviewSessionWordIds && reviewSessionWordIds.length > 0
      ? new Set(reviewSessionWordIds)
      : null;
  const sessionWords =
    reviewSessionIdSet && reviewSessionIdSet.size > 0
      ? words.filter((word) => reviewSessionIdSet.has(word.id))
      : null;
  const sourceWords = sessionWords ?? words;

  const savedEntries = sourceWords
    .map((word) => toGameEntry(word, { normalizeWord }))
    .filter(Boolean)
    .filter((entry) => entry.word.length >= minLength);
  const orderedEntries = sessionWords
    ? orderEntriesByWordIds(savedEntries, reviewSessionWordIds)
    : savedEntries;

  const usingReviewSession = Boolean(sessionWords && orderedEntries.length > 0);
  const usingFallback = usingReviewSession
    ? false
    : orderedEntries.length < minWords;
  const entries = usingFallback
    ? GAME_FALLBACK_WORDS.map((entry) => ({ ...entry, wordId: null }))
    : orderedEntries;

  if (usingReviewSession) {
    const priorityWordIds = new Set(
      savedEntries.map((entry) => entry.wordId).filter(Boolean),
    );

    return {
      entries,
      isPriorityLimited: false,
      priorityCount: savedEntries.length,
      priorityWordIds,
      totalPriorityCount: savedEntries.length,
      usingFallback: false,
      usingReviewSession: true,
    };
  }

  const priorityReview = usingFallback
    ? { sessionWords: [], totalCount: 0, isLimited: false }
    : getLimitedPriorityReviewWords(words);
  const priorityWordIds = new Set(priorityReview.sessionWords.map((word) => word.id));
  const totalPriorityCount = priorityReview.totalCount;
  const isPriorityLimited = priorityReview.isLimited;
  const priorityCount = savedEntries.filter(
    (entry) => entry.wordId && priorityWordIds.has(entry.wordId),
  ).length;

  return {
    entries,
    isPriorityLimited,
    priorityCount,
    priorityWordIds,
    totalPriorityCount,
    usingFallback,
    usingReviewSession: false,
  };
}

export function isPriorityEntry(entry, priorityWordIds) {
  return Boolean(entry.wordId && priorityWordIds.has(entry.wordId));
}

export function pickRandomEntry(
  entries,
  priorityWordIds,
  { priorityChance = PRIORITY_PICK_CHANCE } = {},
) {
  if (entries.length === 0) {
    return null;
  }

  const priorityEntries = entries.filter((entry) =>
    isPriorityEntry(entry, priorityWordIds),
  );
  const pool =
    priorityEntries.length > 0 && Math.random() < priorityChance
      ? priorityEntries
      : entries;

  return pool[Math.floor(Math.random() * pool.length)] ?? entries[0];
}

export function pickFixedRoundEntries(entries, priorityWordIds, totalRounds) {
  if (entries.length === 0) {
    return [];
  }

  const priorityEntries = shuffleArray(
    entries.filter((entry) => isPriorityEntry(entry, priorityWordIds)),
  );
  const normalEntries = shuffleArray(
    entries.filter((entry) => !isPriorityEntry(entry, priorityWordIds)),
  );
  const minPriorityCount = Math.min(
    priorityEntries.length,
    Math.ceil(totalRounds / 2),
  );
  const picked = [...priorityEntries.slice(0, minPriorityCount)];
  const remainingPool = shuffleArray([
    ...priorityEntries.slice(minPriorityCount),
    ...normalEntries,
  ]);

  while (picked.length < totalRounds && remainingPool.length > 0) {
    picked.push(remainingPool.shift());
  }

  while (picked.length < totalRounds) {
    picked.push(entries[picked.length % entries.length]);
  }

  return shuffleArray(picked.slice(0, totalRounds));
}

export function buildTranslationQuizQuestions(entries, priorityWordIds, totalRounds) {
  return pickFixedRoundEntries(entries, priorityWordIds, totalRounds).map((item) =>
    buildTranslationQuizQuestion(item, entries),
  );
}

export function buildTranslationQuizQuestionsFromEntries(roundEntries, entries) {
  return roundEntries.map((item) => buildTranslationQuizQuestion(item, entries));
}

function buildTranslationQuizQuestion(item, entries) {
  const wrongPool = entries
    .filter((candidate) => candidate.meaning !== item.meaning)
    .map((candidate) => candidate.meaning);

  return {
    en: item.word,
    zh: item.meaning,
    choices: shuffleArray([item.meaning, ...shuffleArray(wrongPool).slice(0, 3)]),
  };
}

export function filterEntriesForNinjaLevel(entries, level) {
  const filteredEntries = entries.filter((entry) => {
    if (level <= 2) {
      return entry.word.length <= 6;
    }

    if (level <= 5) {
      return entry.word.length <= 9;
    }

    return true;
  });

  return filteredEntries.length > 0 ? filteredEntries : entries;
}

export function pickNinjaWord(entries, priorityWordIds, level) {
  const availableEntries = filterEntriesForNinjaLevel(entries, level);

  return pickRandomEntry(availableEntries, priorityWordIds) ?? entries[0] ?? null;
}
