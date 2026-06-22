import { readJsonResponse } from "./completeWordApi.js";
import { getApiAuthHeaders } from "../../lib/apiAuth.js";
import { resolveApiUrl } from "../../lib/apiBase.js";
import {
  buildWordMemoryImageChanges,
  readStoredMemoryImage,
  writeStoredMemoryImage,
} from "../../lib/wordAiMemoryStorage.js";
import {
  canUseWordbase,
  contributeMemoryImageToWordbase,
  fetchWordbaseEntry,
  hasWordbaseMemoryImage,
} from "./wordbaseApi.js";

export const WORD_IMAGE_CACHE_KEY = "lexiland.wordImageCache.v1";

function getDefaultStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function loadLegacyCache(storage = getDefaultStorage()) {
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

function stripSavedAt(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  const { savedAt: _savedAt, ...image } = value;

  return image;
}

function readLegacyCachedWordImage(word, storage = getDefaultStorage()) {
  const cache = loadLegacyCache(storage);
  const legacyKeys = [
    word.id,
    `${word.id}:${word.updatedAt ?? word.createdAt ?? word.term}`,
  ];

  for (const key of legacyKeys) {
    const entry = cache[key];

    if (entry?.imageUrl) {
      return entry;
    }
  }

  for (const [key, entry] of Object.entries(cache)) {
    if (key.startsWith(`${word.id}:`) && entry?.imageUrl) {
      return entry;
    }
  }

  return null;
}

export function readWordMemoryImage(word, storage = getDefaultStorage()) {
  if (word.memoryImage?.imageUrl) {
    return stripSavedAt(word.memoryImage);
  }

  const fromStore = readStoredMemoryImage(word.id, storage);

  if (fromStore?.imageUrl) {
    return stripSavedAt(fromStore);
  }

  const legacyImage = readLegacyCachedWordImage(word, storage);

  if (legacyImage?.imageUrl) {
    writeStoredMemoryImage(word.id, legacyImage, storage);
    return legacyImage;
  }

  return null;
}

export function persistWordMemoryImage(word, memoryImage, storage = getDefaultStorage()) {
  writeStoredMemoryImage(word.id, memoryImage, storage);

  return buildWordMemoryImageChanges(memoryImage);
}

export function clearWordImageCache(storage = getDefaultStorage()) {
  if (!storage) {
    return;
  }

  storage.removeItem(WORD_IMAGE_CACHE_KEY);
}

export async function fetchWordImage(word, { timeoutMs = 90000 } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const authHeaders = await getApiAuthHeaders();

  try {
    const response = await fetch(resolveApiUrl("/api/word-memory-image"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        term: word.term,
        definition: word.definition,
        translation: word.translation,
        partOfSpeech: word.partOfSpeech,
        example: word.example,
      }),
      signal: controller.signal,
    });
    const data = await readJsonResponse(response);

    if (!response.ok) {
      throw new Error(data.error || "Could not generate a memory image.");
    }

    return {
      imageUrl: data.imageUrl,
      prompt: data.prompt ?? "",
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Image generation timed out. Please try again.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchWordImageWithCache(
  word,
  { forceRefresh = false, user } = {},
) {
  if (!forceRefresh) {
    const savedImage = readWordMemoryImage(word);

    if (savedImage) {
      return {
        ...savedImage,
        fromCache: true,
      };
    }

    if (canUseWordbase(user)) {
      try {
        const entry = await fetchWordbaseEntry(word.term);

        if (hasWordbaseMemoryImage(entry)) {
          const memoryImage = stripSavedAt(entry.memoryImage);
          const changes = persistWordMemoryImage(word, memoryImage);

          return {
            ...memoryImage,
            changes,
            fromCache: false,
            fromWordbase: true,
          };
        }
      } catch (wordbaseError) {
        console.warn("Could not read memory image from wordbase.", wordbaseError);
      }
    }
  }

  const image = await fetchWordImage(word);
  const changes = persistWordMemoryImage(word, image);

  if (canUseWordbase(user) && image.imageUrl) {
    void contributeMemoryImageToWordbase(word, image, user.id).catch((syncError) => {
      console.warn("Could not contribute memory image to wordbase.", syncError);
    });
  }

  return {
    ...image,
    changes,
    fromCache: false,
    fromWordbase: false,
  };
}
