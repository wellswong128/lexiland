import { readJsonResponse } from "./completeWordApi.js";
import { getApiAuthHeaders } from "../../lib/apiAuth.js";
import { resolveApiUrl } from "../../lib/apiBase.js";
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

export function createDemoMemoryTips(word, locale = "zh-Hant") {
  const term = word.term.trim();
  const isEnglish = locale === "en";

  if (isEnglish) {
    return {
      summary: `Break "${term}" into smaller pieces and attach it to a vivid image.`,
      tips: [
        {
          method: "Sound Link",
          content: `Say "${term}" aloud three times, then link its first syllable to a familiar English word you already know.`,
        },
        {
          method: "Sentence Hook",
          content: word.example
            ? `Reuse the example sentence and underline "${term}" each time you read it.`
            : `Make one short sentence with "${term}" about your daily life.`,
        },
        {
          method: "Review Trick",
          content: "Cover the translation, recall the meaning, then say the word again within 10 seconds.",
        },
      ],
    };
  }

  const isSimplified = locale === "zh-Hans";
  const summary = isSimplified
    ? `把 "${term}" 和一个具体画面绑在一起，比死记拼写更有效。`
    : `把「${term}」和一個具體畫面綁在一起，比死記拼寫更有效。`;

  return {
    summary,
    tips: [
      {
        method: isSimplified ? "谐音联想" : "諧音聯想",
        content: isSimplified
          ? `先大声读 "${term}"，再找一个发音相近的中文词，想象它们出现在同一个画面里。`
          : `先大聲讀「${term}」，再找一個發音相近的中文詞，想像它們出現在同一個畫面裡。`,
      },
      {
        method: isSimplified ? "例句记忆" : "例句記憶",
        content: word.example
          ? isSimplified
            ? `反复朗读例句：${word.example}，每次读到 "${term}" 都停一下。`
            : `反覆朗讀例句：${word.example}，每次讀到「${term}」都停一下。`
          : isSimplified
            ? `自己造一个包含 "${term}" 的短句，并立刻口头复述三遍。`
            : `自己造一個包含「${term}」的短句，並立刻口頭複述三遍。`,
      },
      {
        method: isSimplified ? "复习技巧" : "複習技巧",
        content: isSimplified
          ? "遮住中文释义，先回忆英文单词，再回忆意思，10 秒内完成才算记住。"
          : "遮住中文釋義，先回憶英文單字，再回憶意思，10 秒內完成才算記住。",
      },
    ],
  };
}

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
    const memoryTips = createDemoMemoryTips(word, locale);
    const changes = persistWordMemoryTips(word, locale, memoryTips);

    return {
      memoryTips,
      usedFallback: true,
      fallbackReason: error.message,
      changes,
      fromCache: false,
      fromWordbase: false,
    };
  }
}
