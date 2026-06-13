import { getDueWords } from "../review/reviewHelpers.js";

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
  const dueWordIds = new Set(getDueWords(words, now).map((word) => word.id));

  return new Set(
    words
      .filter((word) => word.mistake?.isMistake || dueWordIds.has(word.id))
      .map((word) => word.id),
  );
}

export function buildGameWordBank(
  words,
  {
    minWords = 4,
    minLength = 1,
    normalizeWord = (term) => term.trim().toLowerCase(),
  } = {},
) {
  const savedEntries = words
    .map((word) => toGameEntry(word, { normalizeWord }))
    .filter(Boolean)
    .filter((entry) => entry.word.length >= minLength);

  const usingFallback = savedEntries.length < minWords;
  const entries = usingFallback
    ? GAME_FALLBACK_WORDS.map((entry) => ({ ...entry, wordId: null }))
    : savedEntries;
  const priorityWordIds = usingFallback ? new Set() : getPriorityWordIds(words);
  const priorityCount = savedEntries.filter(
    (entry) => entry.wordId && priorityWordIds.has(entry.wordId),
  ).length;

  return {
    entries,
    priorityCount,
    priorityWordIds,
    usingFallback,
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
  return pickFixedRoundEntries(entries, priorityWordIds, totalRounds).map((item) => {
    const wrongPool = entries
      .filter((candidate) => candidate.meaning !== item.meaning)
      .map((candidate) => candidate.meaning);

    return {
      en: item.word,
      zh: item.meaning,
      choices: shuffleArray([item.meaning, ...shuffleArray(wrongPool).slice(0, 3)]),
    };
  });
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
