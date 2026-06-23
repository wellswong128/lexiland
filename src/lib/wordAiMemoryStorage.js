export const WORD_AI_MEMORY_STORAGE_KEY = "lexiland.wordAiMemory.v1";

function getDefaultStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function loadStore(storage = getDefaultStorage()) {
  if (!storage) {
    return {};
  }

  const rawValue = storage.getItem(WORD_AI_MEMORY_STORAGE_KEY);

  if (!rawValue) {
    return {};
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    return parsedValue && typeof parsedValue === "object" ? parsedValue : {};
  } catch {
    return {};
  }
}

function saveStore(store, storage = getDefaultStorage()) {
  if (!storage) {
    return;
  }

  storage.setItem(WORD_AI_MEMORY_STORAGE_KEY, JSON.stringify(store));
}

function getWordEntry(wordId, storage = getDefaultStorage()) {
  const store = loadStore(storage);

  return store[wordId] ?? {
    memoryTipsByLocale: {},
    memoryImage: null,
  };
}

function writeWordEntry(wordId, entry, storage = getDefaultStorage()) {
  const store = loadStore(storage);
  store[wordId] = entry;
  saveStore(store, storage);
}

export function readStoredMemoryTips(wordId, locale, storage = getDefaultStorage()) {
  return getWordEntry(wordId, storage).memoryTipsByLocale?.[locale] ?? null;
}

export function readStoredMemoryImage(wordId, storage = getDefaultStorage()) {
  return getWordEntry(wordId, storage).memoryImage ?? null;
}

export function writeStoredMemoryTips(
  wordId,
  locale,
  memoryTips,
  storage = getDefaultStorage(),
) {
  const entry = getWordEntry(wordId, storage);

  writeWordEntry(
    wordId,
    {
      ...entry,
      memoryTipsByLocale: {
        ...entry.memoryTipsByLocale,
        [locale]: {
          ...memoryTips,
          savedAt: new Date().toISOString(),
        },
      },
    },
    storage,
  );
}

export function writeStoredMemoryImage(wordId, memoryImage, storage = getDefaultStorage()) {
  const entry = getWordEntry(wordId, storage);

  writeWordEntry(
    wordId,
    {
      ...entry,
      memoryImage: {
        ...memoryImage,
        savedAt: new Date().toISOString(),
      },
    },
    storage,
  );
}

export function clearStoredWordAiMemory(wordId, storage = getDefaultStorage()) {
  const store = loadStore(storage);

  if (!store[wordId]) {
    return;
  }

  delete store[wordId];
  saveStore(store, storage);
}

export function clearAllStoredWordAiMemory(storage = getDefaultStorage()) {
  if (!storage) {
    return;
  }

  storage.removeItem(WORD_AI_MEMORY_STORAGE_KEY);
}

const emptyMemoryEntry = {
  memoryTipsByLocale: {},
  memoryImage: null,
};

export function hydrateWordAiMemory(word, storage = getDefaultStorage(), store = null) {
  const entry = store ? (store[word.id] ?? emptyMemoryEntry) : getWordEntry(word.id, storage);

  return {
    ...word,
    memoryTipsByLocale: {
      ...entry.memoryTipsByLocale,
      ...(word.memoryTipsByLocale ?? {}),
    },
    memoryImage: word.memoryImage ?? entry.memoryImage ?? null,
  };
}

export function hydrateWordsAiMemory(words, storage = getDefaultStorage()) {
  if (!Array.isArray(words) || words.length === 0) {
    return [];
  }

  const store = loadStore(storage);

  return words.map((word) => hydrateWordAiMemory(word, storage, store));
}

export function buildWordMemoryTipsChanges(word, locale, memoryTips) {
  const nextTipsByLocale = {
    ...(word.memoryTipsByLocale ?? {}),
    [locale]: {
      ...memoryTips,
      savedAt: new Date().toISOString(),
    },
  };

  return {
    memoryTipsByLocale: nextTipsByLocale,
  };
}

export function buildWordMemoryImageChanges(memoryImage) {
  return {
    memoryImage: {
      ...memoryImage,
      savedAt: new Date().toISOString(),
    },
  };
}
