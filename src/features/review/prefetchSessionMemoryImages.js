import { readWordMemoryTips } from "../words/memoryTipsApi.js";
import {
  fetchWordImageWithCache,
  readWordMemoryImage,
} from "../words/wordImageApi.js";
import {
  fetchWordMemoryWithCache,
} from "../words/wordMemoryApi.js";
import { hasMemoryImageUrl, normalizeMemoryImage } from "../words/memoryImageUtils.js";
import { buildWordMemoryImageChanges } from "../../lib/wordAiMemoryStorage.js";

const PREFETCH_CONCURRENCY = 4;

async function runWithConcurrency(items, worker, limit = PREFETCH_CONCURRENCY) {
  if (items.length === 0) {
    return;
  }

  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) {
        break;
      }

      await worker(item);
    }
  });

  await Promise.all(workers);
}

function needsWordbaseImage(word) {
  return !hasMemoryImageUrl(readWordMemoryImage(word));
}

function needsWordbaseTips(word, locale) {
  return !readWordMemoryTips(word, locale);
}

function needsWordbaseMemory(word, locale) {
  return needsWordbaseImage(word) || needsWordbaseTips(word, locale);
}

async function prefetchWordMemoryFromWordbase(word, { locale, updateWord, user }) {
  const needsImage = needsWordbaseImage(word);
  const needsTips = needsWordbaseTips(word, locale);

  if (!needsImage && !needsTips) {
    return;
  }

  if (needsImage && !needsTips) {
    const result = await fetchWordImageWithCache(word, { user, wordbaseOnly: true });
    const memoryImage = normalizeMemoryImage(result);

    if (memoryImage) {
      const changes = result.changes ?? buildWordMemoryImageChanges(memoryImage);
      if (result.changes) {
        await updateWord(word.id, result.changes);
      }
    }

    return;
  }

  const result = await fetchWordMemoryWithCache(word, locale, {
    user,
    wordbaseOnly: true,
  });

  if (result.changes) {
    await updateWord(word.id, result.changes);
  }
}

export async function prefetchSessionMemoryImages(
  sessionWords,
  { locale = "zh-Hant", onProgress, updateWord, user },
) {
  const queue = sessionWords.filter((word) => needsWordbaseMemory(word, locale));
  let completed = 0;

  await runWithConcurrency(queue, async (word) => {
    try {
      await prefetchWordMemoryFromWordbase(word, { locale, updateWord, user });
    } catch (error) {
      console.warn("Could not prefetch review memory from wordbase.", word.term, error);
    } finally {
      completed += 1;
      onProgress?.(completed, queue.length);
    }
  });
}

export function wordNeedsReviewMemoryImage(word, locale = "zh-Hant") {
  return needsWordbaseMemory(word, locale);
}
