import { createImageQuizQuestions, wordHasMemoryImage } from "./imageQuizHelpers.js";
import { fetchWordImageWithCache } from "../words/wordImageApi.js";
import { buildWordMemoryImageChanges } from "../../lib/wordAiMemoryStorage.js";
import { normalizeMemoryImage } from "../words/memoryImageUtils.js";

const EXTRA_PREFETCH_LIMIT = 12;

function applyWordChanges(words, wordId, changes) {
  return words.map((word) => (word.id === wordId ? { ...word, ...changes } : word));
}

function buildPrefetchQueue(sessionWords, allWords) {
  const queue = [...sessionWords];
  const queuedIds = new Set(sessionWords.map((word) => word.id));

  for (const word of allWords) {
    if (queue.length >= sessionWords.length + EXTRA_PREFETCH_LIMIT) {
      break;
    }

    if (!queuedIds.has(word.id)) {
      queue.push(word);
      queuedIds.add(word.id);
    }
  }

  return queue;
}

async function fetchWordImageIntoPool(word, workingWords, { updateWord, user } = {}) {
  const result = await fetchWordImageWithCache(word, { user, wordbaseOnly: true });

  if (result.wordbaseMiss) {
    return workingWords;
  }

  const memoryImage = normalizeMemoryImage(result);
  if (!memoryImage) {
    return workingWords;
  }

  const changes = result.changes ?? buildWordMemoryImageChanges(memoryImage);

  if (result.changes) {
    await updateWord(word.id, result.changes);
  }

  return applyWordChanges(workingWords, word.id, changes);
}

export async function prefetchImageReviewPool(
  sessionWords,
  allWords,
  { onProgress, updateWord, user } = {},
) {
  let workingWords = allWords;
  const queue = buildPrefetchQueue(sessionWords, allWords);
  let sessionProgress = 0;

  for (let index = 0; index < queue.length; index += 1) {
    const word = queue[index];
    const currentWord = workingWords.find((item) => item.id === word.id) ?? word;

    if (!wordHasMemoryImage(currentWord)) {
      workingWords = await fetchWordImageIntoPool(word, workingWords, {
        updateWord,
        user,
      });
    }

    if (index < sessionWords.length) {
      sessionProgress += 1;
      onProgress?.(sessionProgress, sessionWords.length);
    }
  }

  return {
    questions: createImageQuizQuestions(sessionWords, workingWords),
    words: workingWords,
  };
}
