import { readWordMemoryImage } from "../words/wordImageApi.js";
import { hasMemoryImageUrl } from "../words/memoryImageUtils.js";
import { applyReviewMemoryImageLocally, reviewWordNeedsMemoryImage } from "./reviewWordbaseMemory.js";
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

export async function prefetchSessionMemoryImages(
  sessionWords,
  { allWords = sessionWords, onProgress, updateWord } = {},
) {
  const prefetchWords = buildImagePrefetchQueue(sessionWords, allWords);
  const queue = prefetchWords.filter((word) => reviewWordNeedsMemoryImage(word));
  let completed = 0;

  await runWithConcurrency(queue, async (word) => {
    try {
      await applyReviewMemoryImageLocally(word, { updateWord });
    } catch (error) {
      console.warn("Could not hydrate review memory image locally.", word.term, error);
    } finally {
      completed += 1;
      onProgress?.(completed, queue.length);
    }
  });
}

export function wordNeedsReviewMemoryImage(word) {
  return reviewWordNeedsMemoryImage(word);
}

export function wordHasReviewMemoryImage(word) {
  return hasMemoryImageUrl(readWordMemoryImage(word));
}
