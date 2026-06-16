import {
  getReviewSessionEntryOrder,
  hasActiveReviewSession,
  loadReviewSession,
} from "../../lib/reviewSessionStorage.js";
import {
  getLimitedMaintenanceReviewWords,
  getLimitedPriorityReviewWords,
  getMaintenanceReviewWords,
  getMaintenanceScore,
  REVIEW_SESSION_WORD_LIMIT,
} from "../review/reviewHelpers.js";

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

function normalizePickOptions(priorityWordIdsOrBank, overrides = {}) {
  if (priorityWordIdsOrBank instanceof Set) {
    return {
      priorityWordIds: priorityWordIdsOrBank,
      maintenanceWordIds: new Set(),
      maintenanceScores: new Map(),
      usingMaintenanceMode: false,
      priorityChance: PRIORITY_PICK_CHANCE,
      ...overrides,
    };
  }

  const bank = priorityWordIdsOrBank ?? {};

  return {
    priorityWordIds: bank.priorityWordIds ?? new Set(),
    maintenanceWordIds: bank.maintenanceWordIds ?? new Set(),
    maintenanceScores: bank.maintenanceScores ?? new Map(),
    usingMaintenanceMode: Boolean(bank.usingMaintenanceMode),
    priorityChance: overrides.priorityChance ?? PRIORITY_PICK_CHANCE,
    ...overrides,
  };
}

function pickUniformRandom(entries) {
  return entries[Math.floor(Math.random() * entries.length)] ?? entries[0] ?? null;
}

function pickWeightedRandom(entries, scoreByWordId) {
  if (entries.length === 0) {
    return null;
  }

  const weights = entries.map((entry) => {
    const score = entry.wordId ? scoreByWordId.get(entry.wordId) ?? 1 : 1;

    return Math.max(score, 1);
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let threshold = Math.random() * totalWeight;

  for (let index = 0; index < entries.length; index += 1) {
    threshold -= weights[index];

    if (threshold <= 0) {
      return entries[index];
    }
  }

  return entries[entries.length - 1];
}

function buildMaintenanceScores(words, now = new Date()) {
  return new Map(words.map((word) => [word.id, getMaintenanceScore(word, now)]));
}

export function expandWordIdsForGamePool(
  words,
  seedWordIds,
  {
    targetCount = REVIEW_SESSION_WORD_LIMIT,
    minCount = 4,
    minLength = 1,
    normalizeWord = (term) => term.trim().toLowerCase(),
    now = new Date(),
  } = {},
) {
  const eligibleWords = words.filter((word) => {
    const entry = toGameEntry(word, { normalizeWord });

    return entry && entry.word.length >= minLength;
  });
  const goal = Math.min(Math.max(minCount, targetCount), eligibleWords.length);
  const wordsById = new Map(eligibleWords.map((word) => [word.id, word]));
  const selectedIds = [];
  const selectedSet = new Set();

  for (const wordId of seedWordIds) {
    if (selectedSet.has(wordId) || !wordsById.has(wordId)) {
      continue;
    }

    selectedIds.push(wordId);
    selectedSet.add(wordId);
  }

  if (selectedIds.length >= goal) {
    return selectedIds.slice(0, goal);
  }

  const supplementalWords = getMaintenanceReviewWords(
    eligibleWords.filter((word) => !selectedSet.has(word.id)),
    now,
  );

  for (const word of supplementalWords) {
    if (selectedIds.length >= goal) {
      break;
    }

    selectedIds.push(word.id);
    selectedSet.add(word.id);
  }

  return selectedIds;
}

function buildGameplayWordIds(words, seedWordIds, options = {}) {
  const expandedWordIds = expandWordIdsForGamePool(words, seedWordIds, options);

  return {
    expandedWordIds,
    priorityWordIds: new Set(seedWordIds.filter(Boolean)),
    sessionExpanded: expandedWordIds.length > seedWordIds.filter(Boolean).length,
    supplementedCount: Math.max(expandedWordIds.length - seedWordIds.filter(Boolean).length, 0),
  };
}

function buildEntriesFromGamePlan(
  words,
  gamePlanWordIds,
  { minLength = 1, normalizeWord = (term) => term.trim().toLowerCase() } = {},
) {
  if (!gamePlanWordIds?.length) {
    return [];
  }

  const wordsById = new Map(words.map((word) => [word.id, word]));

  return gamePlanWordIds
    .map((wordId) => wordsById.get(wordId))
    .filter(Boolean)
    .map((word) => toGameEntry(word, { normalizeWord }))
    .filter(Boolean)
    .filter((entry) => entry.word.length >= minLength);
}

export function shouldUseGamePlan(bank) {
  return (
    hasActiveReviewSession() &&
    Boolean(bank?.entries.length) &&
    !bank?.sessionExpanded
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
  if (hasActiveReviewSession()) {
    const session = loadReviewSession();
    const sessionPriorityIds = session?.wordIds ?? [];
    const {
      expandedWordIds,
      priorityWordIds,
      sessionExpanded,
      supplementedCount,
    } = buildGameplayWordIds(words, sessionPriorityIds, {
      minCount: minWords,
      minLength,
      normalizeWord,
      targetCount: REVIEW_SESSION_WORD_LIMIT,
    });
    const gamePlanWordIds = sessionExpanded
      ? expandedWordIds
      : (getReviewSessionEntryOrder() ?? expandedWordIds);
    const entries = buildEntriesFromGamePlan(words, gamePlanWordIds, {
      minLength,
      normalizeWord,
    });

    return {
      entries,
      gamePlanWordIds,
      hasReviewSession: true,
      isPriorityLimited: false,
      maintenanceScores: new Map(),
      maintenanceWordIds: new Set(),
      priorityCount: sessionPriorityIds.length,
      priorityWordIds,
      sessionExpanded,
      supplementedCount,
      totalMaintenanceCount: 0,
      totalPriorityCount: session?.totalCount ?? sessionPriorityIds.length,
      usingFallback: false,
      usingMaintenanceMode: false,
      usingReviewSession: entries.length > 0,
    };
  }

  const savedEntries = words
    .map((word) => toGameEntry(word, { normalizeWord }))
    .filter(Boolean)
    .filter((entry) => entry.word.length >= minLength);
  const usingFallback = savedEntries.length < minWords;
  const entries = usingFallback
    ? GAME_FALLBACK_WORDS.map((entry) => ({ ...entry, wordId: null }))
    : savedEntries;

  const priorityReview = usingFallback
    ? { sessionWords: [], totalCount: 0, isLimited: false }
    : getLimitedPriorityReviewWords(words);
  const usingMaintenanceMode = !usingFallback && priorityReview.totalCount === 0;
  const maintenanceReview = usingMaintenanceMode
    ? getLimitedMaintenanceReviewWords(words)
    : { sessionWords: [], totalCount: 0, isLimited: false };
  const prioritySeedIds = priorityReview.sessionWords.map((word) => word.id);
  const gameplayPool = usingFallback
    ? {
        expandedWordIds: [],
        priorityWordIds: new Set(),
        sessionExpanded: false,
        supplementedCount: 0,
      }
    : usingMaintenanceMode
      ? {
          expandedWordIds: maintenanceReview.sessionWords.map((word) => word.id),
          priorityWordIds: new Set(),
          sessionExpanded: false,
          supplementedCount: 0,
        }
      : buildGameplayWordIds(words, prioritySeedIds, {
          minCount: minWords,
          minLength,
          normalizeWord,
          targetCount: REVIEW_SESSION_WORD_LIMIT,
        });
  const priorityWordIds = usingMaintenanceMode
    ? new Set()
    : gameplayPool.priorityWordIds;
  const maintenanceWordIds = usingMaintenanceMode
    ? new Set(gameplayPool.expandedWordIds)
    : new Set();
  const maintenanceScores = usingMaintenanceMode ? buildMaintenanceScores(words) : new Map();
  const totalPriorityCount = priorityReview.totalCount;
  const totalMaintenanceCount = maintenanceReview.totalCount;
  const isPriorityLimited = priorityReview.isLimited;
  const priorityCount = savedEntries.filter(
    (entry) => entry.wordId && priorityWordIds.has(entry.wordId),
  ).length;

  return {
    entries,
    gamePlanWordIds: null,
    hasReviewSession: false,
    isPriorityLimited,
    maintenanceScores,
    maintenanceWordIds,
    priorityCount,
    priorityWordIds,
    sessionExpanded: gameplayPool.sessionExpanded,
    supplementedCount: gameplayPool.supplementedCount,
    totalMaintenanceCount,
    totalPriorityCount,
    usingFallback,
    usingMaintenanceMode,
    usingReviewSession: false,
  };
}

export function isPriorityEntry(entry, priorityWordIds) {
  return Boolean(entry.wordId && priorityWordIds.has(entry.wordId));
}

export function pickRandomEntry(entries, priorityWordIdsOrBank, overrides = {}) {
  if (entries.length === 0) {
    return null;
  }

  const {
    priorityWordIds,
    maintenanceWordIds,
    maintenanceScores,
    usingMaintenanceMode,
    priorityChance,
  } = normalizePickOptions(priorityWordIdsOrBank, overrides);
  const priorityEntries = entries.filter((entry) =>
    isPriorityEntry(entry, priorityWordIds),
  );

  if (priorityEntries.length > 0 && Math.random() < priorityChance) {
    return pickUniformRandom(priorityEntries);
  }

  if (usingMaintenanceMode) {
    const focusEntries = entries.filter(
      (entry) => entry.wordId && maintenanceWordIds.has(entry.wordId),
    );
    const pool =
      focusEntries.length > 0 && Math.random() < priorityChance ? focusEntries : entries;

    return pickWeightedRandom(pool, maintenanceScores) ?? pickUniformRandom(entries);
  }

  return pickUniformRandom(entries);
}

export function pickFixedRoundEntries(entries, priorityWordIdsOrBank, totalRounds) {
  if (entries.length === 0) {
    return [];
  }

  const {
    priorityWordIds,
    maintenanceWordIds,
    maintenanceScores,
    usingMaintenanceMode,
  } = normalizePickOptions(priorityWordIdsOrBank);
  const focusWordIds =
    priorityWordIds.size > 0
      ? priorityWordIds
      : usingMaintenanceMode
        ? maintenanceWordIds
        : new Set();
  const focusEntries = shuffleArray(
    entries.filter((entry) => entry.wordId && focusWordIds.has(entry.wordId)),
  );
  const normalEntries = shuffleArray(
    entries.filter((entry) => !entry.wordId || !focusWordIds.has(entry.wordId)),
  );
  const minFocusCount = Math.min(focusEntries.length, Math.ceil(totalRounds / 2));
  const picked = [...focusEntries.slice(0, minFocusCount)];
  const remainingPool = shuffleArray([
    ...focusEntries.slice(minFocusCount),
    ...normalEntries,
  ]);

  while (picked.length < totalRounds && remainingPool.length > 0) {
    if (usingMaintenanceMode && priorityWordIds.size === 0) {
      const nextEntry = pickWeightedRandom(remainingPool, maintenanceScores);

      if (nextEntry) {
        picked.push(nextEntry);
        remainingPool.splice(remainingPool.indexOf(nextEntry), 1);
        continue;
      }
    }

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

export function getSequentialRoundEntries(entries, totalRounds) {
  if (entries.length === 0 || totalRounds <= 0) {
    return [];
  }

  const rounds = [];

  for (let index = 0; index < totalRounds; index += 1) {
    rounds.push(entries[index % entries.length]);
  }

  return rounds;
}

export function buildGameTranslationQuizQuestions(bank, totalRounds) {
  if (shouldUseGamePlan(bank)) {
    if (bank.entries.length === 0) {
      return [];
    }

    return buildTranslationQuizQuestionsFromEntries(
      getSequentialRoundEntries(bank.entries, totalRounds),
      bank.entries,
    );
  }

  return buildTranslationQuizQuestions(bank.entries, bank, totalRounds);
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

export function pickNinjaWord(entries, priorityWordIdsOrBank, level) {
  const availableEntries = filterEntriesForNinjaLevel(entries, level);

  return pickRandomEntry(availableEntries, priorityWordIdsOrBank) ?? entries[0] ?? null;
}
