import {
  fetchWordMemoryWithCache,
  readWordMemory,
} from "../words/wordMemoryApi.js";

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

function needsWordbaseMemory(word, locale) {
  const saved = readWordMemory(word, locale);
  return !saved.memoryImage?.imageUrl || !saved.memoryTips;
}

export async function prefetchSessionMemoryImages(
  sessionWords,
  { locale = "zh-Hant", onProgress, updateWord, user },
) {
  const queue = sessionWords.filter((word) => needsWordbaseMemory(word, locale));
  let completed = 0;

  await runWithConcurrency(queue, async (word) => {
    try {
      const result = await fetchWordMemoryWithCache(word, locale, {
        user,
        wordbaseOnly: true,
      });

      if (result.changes) {
        await updateWord(word.id, result.changes);
      }
    } catch (error) {
      console.warn("Could not prefetch review memory from wordbase.", word.term, error);
    } finally {
      completed += 1;
      onProgress?.(completed, queue.length);
    }
  });
}
