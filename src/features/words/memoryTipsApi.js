import { readJsonResponse } from "./completeWordApi.js";
import { getApiAuthHeaders } from "../../lib/apiAuth.js";
import { resolveApiUrl } from "../../lib/apiBase.js";
import {
  createDemoMemoryTips,
  createFallbackMemoryTipsResult,
} from "./memoryTipsFallback.js";
import {
  buildWordMemoryTipsChanges,
  readStoredMemoryTips,
  writeStoredMemoryTips,
} from "../../lib/wordAiMemoryStorage.js";
import {
  canUseWordbase,
  contributeMemoryTipsToWordbase,
  fetchWordbaseEntry,
  hasWordbaseMemoryTips,
} from "./wordbaseApi.js";

export const MEMORY_TIPS_CACHE_KEY = "lexiland.memoryTipsCache.v1";

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

  const rawValue = storage.getItem(MEMORY_TIPS_CACHE_KEY);

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

  const { savedAt: _savedAt, ...memoryTips } = value;

  return memoryTips;
}

function hasMemoryTips(value) {
  return Array.isArray(value?.tips) && value.tips.length > 0;
}

function readLegacyCachedMemoryTips(word, locale = "zh-Hant", storage = getDefaultStorage()) {
  const cache = loadLegacyCache(storage);
  const legacyKeys = [
    `${word.id}:${locale}`,
    `${word.id}:${word.updatedAt ?? word.createdAt ?? word.term}:${locale}`,
  ];

  for (const key of legacyKeys) {
    const entry = cache[key];

    if (entry?.memoryTips) {
      return entry.memoryTips;
    }
  }

  for (const [key, entry] of Object.entries(cache)) {
    if (key.startsWith(`${word.id}:`) && key.endsWith(`:${locale}`) && entry?.memoryTips) {
      return entry.memoryTips;
    }
  }

  return null;
}

export function readWordMemoryTips(word, locale = "zh-Hant", storage = getDefaultStorage()) {
  const fromWord = word.memoryTipsByLocale?.[locale];

  if (hasMemoryTips(fromWord)) {
    return stripSavedAt(fromWord);
  }

  const fromStore = readStoredMemoryTips(word.id, locale, storage);

  if (hasMemoryTips(fromStore)) {
    return stripSavedAt(fromStore);
  }

  const legacyTips = readLegacyCachedMemoryTips(word, locale, storage);

  if (hasMemoryTips(legacyTips)) {
    writeStoredMemoryTips(word.id, locale, legacyTips, storage);
    return legacyTips;
  }

  return null;
}

export function persistWordMemoryTips(word, locale, memoryTips, storage = getDefaultStorage()) {
  writeStoredMemoryTips(word.id, locale, memoryTips, storage);

  return buildWordMemoryTipsChanges(word, locale, memoryTips);
}

export function clearMemoryTipsCache(storage = getDefaultStorage()) {
  if (!storage) {
    return;
  }

  storage.removeItem(MEMORY_TIPS_CACHE_KEY);
}

export { createDemoMemoryTips };

export async function fetchMemoryTips(word, locale) {
  const authHeaders = await getApiAuthHeaders();
  const response = await fetch(resolveApiUrl("/api/word-memory-tips"), {
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
      locale,
    }),
  });
  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(data.error || "Could not generate memory tips.");
  }

  return {
    memoryTips: data.memoryTips,
    usedFallback: false,
  };
}

export async function fetchMemoryTipsWithFallback(
  word,
  locale,
  { forceRefresh = false, user } = {},
) {
  if (!forceRefresh) {
    const savedTips = readWordMemoryTips(word, locale);

    if (savedTips) {
      return {
        memoryTips: savedTips,
        usedFallback: false,
        fromCache: true,
      };
    }

    if (canUseWordbase(user)) {
      try {
        const entry = await fetchWordbaseEntry(word.term);

        if (hasWordbaseMemoryTips(entry, locale)) {
          const memoryTips = stripSavedAt(entry.memoryTipsByLocale[locale]);
          const changes = persistWordMemoryTips(word, locale, memoryTips);

          return {
            memoryTips,
            usedFallback: false,
            fromCache: false,
            fromWordbase: true,
            changes,
          };
        }
      } catch (wordbaseError) {
        console.warn("Could not read memory tips from wordbase.", wordbaseError);
      }
    }
  }

  try {
    const result = await fetchMemoryTips(word, locale);
    const changes = persistWordMemoryTips(word, locale, result.memoryTips);

    if (canUseWordbase(user) && !result.usedFallback) {
      void contributeMemoryTipsToWordbase(
        word,
        locale,
        result.memoryTips,
        user.id,
      ).catch((syncError) => {
        console.warn("Could not contribute memory tips to wordbase.", syncError);
      });
    }

    return {
      ...result,
      changes,
      fromCache: false,
      fromWordbase: false,
    };
  } catch (error) {
    return createFallbackMemoryTipsResult(word, locale, error);
  }
}
