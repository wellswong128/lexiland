import { readWordMemoryTips } from "../words/memoryTipsApi.js";
import { readWordMemoryImage } from "../words/wordImageApi.js";
import { hasMemoryImageUrl } from "../words/memoryImageUtils.js";
import {
  applyReviewMemoryFromWordbase,
  reviewWordNeedsMemoryImage,
} from "./reviewWordbaseMemory.js";
import { buildImagePrefetchQueue } from "./prefetchImageReviewPool.js";

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

function needsWordbaseTips(word, locale) {
  return !readWordMemoryTips(word, locale);
}

function needsWordbaseMemory(word, locale) {
  return reviewWordNeedsMemoryImage(word) || needsWordbaseTips(word, locale);
}

export async function prefetchSessionMemoryImages(
  sessionWords,
  { allWords = sessionWords, locale = "zh-Hant", onProgress, updateWord, user } = {},
) {
  const prefetchWords = buildImagePrefetchQueue(sessionWords, allWords);
  const queue = prefetchWords.filter((word) => needsWordbaseMemory(word, locale));
  let completed = 0;

  await runWithConcurrency(queue, async (word) => {
    try {
      await applyReviewMemoryFromWordbase(word, { locale, updateWord, user });
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

export function wordHasReviewMemoryImage(word) {
  return hasMemoryImageUrl(readWordMemoryImage(word));
}
