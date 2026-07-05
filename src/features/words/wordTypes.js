export const WORD_SOURCES = {
  MANUAL: "manual",
  IMPORT: "import",
  AI: "ai",
  PHOTO: "photo",
};

const SUPABASE_WORD_SOURCES = new Set([
  WORD_SOURCES.MANUAL,
  WORD_SOURCES.IMPORT,
  WORD_SOURCES.AI,
]);

export function toSupabaseSource(source) {
  if (source === WORD_SOURCES.PHOTO) {
    return WORD_SOURCES.AI;
  }

  if (SUPABASE_WORD_SOURCES.has(source)) {
    return source;
  }

  return WORD_SOURCES.MANUAL;
}

export const REVIEW_RESULTS = {
  CORRECT: "correct",
  INCORRECT: "incorrect",
  REMEMBERED: "remembered",
  FORGOT: "forgot",
};

export const EXAMPLE_WORD = {
  id: "word_1710000000000_abc123",
  term: "resilient",
  definition: "Able to recover quickly from difficulty.",
  translation: "",
  pronunciation: "/ri-ZIL-yent/",
  partOfSpeech: "adjective",
  example: "She is resilient after every setback.",
  exampleTranslation: "她在每次挫折後都能迅速恢復。",
  notes: "Useful for describing people, systems, or communities.",
  tags: ["personality", "advanced"],
  source: WORD_SOURCES.MANUAL,
  createdAt: "2026-06-09T09:00:00.000Z",
  updatedAt: "2026-06-09T09:00:00.000Z",
  review: {
    level: 0,
    nextReviewAt: "2026-06-09T09:00:00.000Z",
    lastReviewedAt: null,
    correctCount: 0,
    incorrectCount: 0,
    lastResult: null,
  },
  mistake: {
    isMistake: false,
    lastMistakeAt: null,
    mistakeCount: 0,
  },
};

export function getCurrentIsoDate() {
  return new Date().toISOString();
}

export function generateWordId(timestamp = Date.now()) {
  const randomPart = Math.random().toString(36).slice(2, 8);

  return `word_${timestamp}_${randomPart}`;
}

export function normalizeText(value) {
  return String(value ?? "").trim();
}

export function normalizeTerm(value) {
  return normalizeText(value).toLowerCase();
}

export function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean);
  }

  if (typeof value === "string") {
    return value.split(",").map(normalizeText).filter(Boolean);
  }

  return [];
}

export function createInitialReview(now = getCurrentIsoDate()) {
  return {
    level: 0,
    nextReviewAt: now,
    lastReviewedAt: null,
    correctCount: 0,
    incorrectCount: 0,
    lastResult: null,
  };
}

export function createInitialMistake() {
  return {
    isMistake: false,
    lastMistakeAt: null,
    mistakeCount: 0,
  };
}

export function createWord(input, options = {}) {
  const now = options.now ?? getCurrentIsoDate();
  const term = normalizeText(input?.term);
  const definition = normalizeText(input?.definition);

  if (!term || !definition) {
    throw new Error("A word needs both term and definition.");
  }

  return {
    id: options.id ?? generateWordId(),
    term,
    definition,
    translation: normalizeText(input?.translation),
    pronunciation: normalizeText(input?.pronunciation),
    partOfSpeech: normalizeText(input?.partOfSpeech),
    example: normalizeText(input?.example),
    exampleTranslation: normalizeText(input?.exampleTranslation),
    notes: normalizeText(input?.notes),
    tags: normalizeTags(input?.tags),
    source: options.source ?? WORD_SOURCES.MANUAL,
    createdAt: now,
    updatedAt: now,
    review: createInitialReview(now),
    mistake: createInitialMistake(),
    memoryTipsByLocale:
      input?.memoryTipsByLocale && typeof input.memoryTipsByLocale === "object"
        ? input.memoryTipsByLocale
        : {},
    memoryImage:
      input?.memoryImage && typeof input.memoryImage === "object"
        ? input.memoryImage
        : null,
  };
}

function getWordLearningScore(word) {
  return Math.max(
    Number(word?.mistake?.mistakeCount) || 0,
    Number(word?.review?.incorrectCount) || 0,
  );
}

function pickPreferredDuplicateWord(existing, candidate) {
  const existingActive = Boolean(existing.mistake?.isMistake);
  const candidateActive = Boolean(candidate.mistake?.isMistake);

  if (candidateActive !== existingActive) {
    return candidateActive ? candidate : existing;
  }

  const existingScore = getWordLearningScore(existing);
  const candidateScore = getWordLearningScore(candidate);

  if (candidateScore !== existingScore) {
    return candidateScore > existingScore ? candidate : existing;
  }

  const existingUpdated = Date.parse(existing.updatedAt || "") || 0;
  const candidateUpdated = Date.parse(candidate.updatedAt || "") || 0;

  if (candidateUpdated !== existingUpdated) {
    return candidateUpdated > existingUpdated ? candidate : existing;
  }

  const existingCreated = Date.parse(existing.createdAt || "") || 0;
  const candidateCreated = Date.parse(candidate.createdAt || "") || 0;

  return candidateCreated > existingCreated ? candidate : existing;
}

export function dedupeWordsByTerm(words) {
  if (!Array.isArray(words) || words.length === 0) {
    return [];
  }

  const byTerm = new Map();

  for (const word of words) {
    const termKey = normalizeTerm(word?.term);

    if (!termKey) {
      continue;
    }

    const existing = byTerm.get(termKey);
    byTerm.set(termKey, existing ? pickPreferredDuplicateWord(existing, word) : word);
  }

  return Array.from(byTerm.values());
}
