export const WORDS_STORAGE_KEY = "lexiland.words.v1";
export const PHOTO_CAPTURE_DRAFT_KEY = "lexiland.photoCaptureDraft.v1";
const LEGACY_WORDS_STORAGE_KEY = "lexiloop.words.v1";

function getDefaultStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function migrateWordsStorageKey(storage) {
  if (storage.getItem(WORDS_STORAGE_KEY)) {
    return;
  }

  const legacyValue = storage.getItem(LEGACY_WORDS_STORAGE_KEY);

  if (!legacyValue) {
    return;
  }

  storage.setItem(WORDS_STORAGE_KEY, legacyValue);
  storage.removeItem(LEGACY_WORDS_STORAGE_KEY);
}

export function loadWords(storage = getDefaultStorage()) {
  if (!storage) {
    return [];
  }

  migrateWordsStorageKey(storage);

  const rawValue = storage.getItem(WORDS_STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      console.warn("Stored LexiLand words are not an array. Using empty list.");
      return [];
    }

    return parsedValue;
  } catch (error) {
    console.warn("Could not parse stored LexiLand words. Using empty list.", error);
    return [];
  }
}

export function saveWords(words, storage = getDefaultStorage()) {
  if (!storage) {
    return;
  }

  storage.setItem(WORDS_STORAGE_KEY, JSON.stringify(words));
}

function getUserWordsStorageKey(userId) {
  return `lexiland.words.${userId}.v1`;
}

export function loadWordsForUser(userId, storage = getDefaultStorage()) {
  if (!storage || !userId) {
    return [];
  }

  const rawValue = storage.getItem(getUserWordsStorageKey(userId));

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      console.warn("Stored LexiLand user words are not an array. Using empty list.");
      return [];
    }

    return toWordsCacheSnapshot(parsedValue);
  } catch (error) {
    console.warn("Could not parse stored LexiLand user words. Using empty list.", error);
    return [];
  }
}

export function saveWordsForUser(userId, words, storage = getDefaultStorage()) {
  if (!storage || !userId) {
    return;
  }

  storage.setItem(getUserWordsStorageKey(userId), JSON.stringify(toWordsCacheSnapshot(words)));
}

export function toWordsCacheSnapshot(words) {
  if (!Array.isArray(words)) {
    return [];
  }

  return words.map((word) => {
    const {
      memoryTipsByLocale: _memoryTipsByLocale,
      memoryImage: _memoryImage,
      ...rest
    } = word;

    return rest;
  });
}

export function resetWords(storage = getDefaultStorage()) {
  if (!storage) {
    return;
  }

  storage.removeItem(WORDS_STORAGE_KEY);
  storage.removeItem(LEGACY_WORDS_STORAGE_KEY);
}

export function resetWordsForUser(userId, storage = getDefaultStorage()) {
  if (!storage || !userId) {
    return;
  }

  storage.removeItem(getUserWordsStorageKey(userId));
}

const PHOTO_CAPTURE_DRAFT_MAX_BYTES = 120_000;

export function loadPhotoCaptureDraft(storage = getDefaultStorage()) {
  if (!storage) {
    return null;
  }

  const rawValue = storage.getItem(PHOTO_CAPTURE_DRAFT_KEY);

  if (!rawValue) {
    return null;
  }

  if (rawValue.length > PHOTO_CAPTURE_DRAFT_MAX_BYTES) {
    console.warn("Photo capture draft was too large and has been cleared.");
    storage.removeItem(PHOTO_CAPTURE_DRAFT_KEY);
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (!parsedValue || typeof parsedValue !== "object") {
      return null;
    }

    return {
      ...parsedValue,
      imageDataUrl: "",
      previewUrl: "",
    };
  } catch (error) {
    console.warn("Could not parse stored photo capture draft.", error);
    return null;
  }
}

export function savePhotoCaptureDraft(draft, storage = getDefaultStorage()) {
  if (!storage) {
    return;
  }

  const { imageDataUrl: _imageDataUrl, previewUrl: _previewUrl, ...rest } = draft;

  try {
    storage.setItem(PHOTO_CAPTURE_DRAFT_KEY, JSON.stringify(rest));
  } catch (error) {
    console.warn("Could not save photo capture draft.", error);
  }
}

export function clearPhotoCaptureDraft(storage = getDefaultStorage()) {
  if (!storage) {
    return;
  }

  storage.removeItem(PHOTO_CAPTURE_DRAFT_KEY);
}
