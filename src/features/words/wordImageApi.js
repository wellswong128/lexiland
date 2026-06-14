import { readJsonResponse } from "./completeWordApi.js";

export const WORD_IMAGE_CACHE_KEY = "lexiland.wordImageCache.v1";

function getDefaultStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function loadCache(storage = getDefaultStorage()) {
  if (!storage) {
    return {};
  }

  const rawValue = storage.getItem(WORD_IMAGE_CACHE_KEY);

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

function saveCache(cache, storage = getDefaultStorage()) {
  if (!storage) {
    return;
  }

  storage.setItem(WORD_IMAGE_CACHE_KEY, JSON.stringify(cache));
}

export function getWordImageCacheKey(word) {
  return `${word.id}:${word.updatedAt ?? word.createdAt ?? word.term}`;
}

export function readCachedWordImage(word, storage = getDefaultStorage()) {
  const cache = loadCache(storage);
  const entry = cache[getWordImageCacheKey(word)];

  if (!entry?.imageUrl) {
    return null;
  }

  return entry;
}

export function writeCachedWordImage(word, image, storage = getDefaultStorage()) {
  const cache = loadCache(storage);
  cache[getWordImageCacheKey(word)] = {
    ...image,
    savedAt: new Date().toISOString(),
  };
  saveCache(cache, storage);
}

export function clearWordImageCache(storage = getDefaultStorage()) {
  if (!storage) {
    return;
  }

  storage.removeItem(WORD_IMAGE_CACHE_KEY);
}

export async function fetchWordImage(word) {
  const response = await fetch("/api/word-memory-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      term: word.term,
      definition: word.definition,
      translation: word.translation,
      partOfSpeech: word.partOfSpeech,
      example: word.example,
    }),
  });
  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || "Could not generate a memory image.");
  }

  return {
    imageUrl: data.imageUrl,
    prompt: data.prompt ?? "",
  };
}

export async function fetchWordImageWithCache(word, { forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const cachedImage = readCachedWordImage(word);

    if (cachedImage) {
      return {
        ...cachedImage,
        fromCache: true,
      };
    }
  }

  const image = await fetchWordImage(word);
  writeCachedWordImage(word, image);

  return {
    ...image,
    fromCache: false,
  };
}
