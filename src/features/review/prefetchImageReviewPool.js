import { createImageQuizQuestions, wordHasMemoryImage } from "./imageQuizHelpers.js";
import { buildWordMemoryImageChanges } from "../../lib/wordAiMemoryStorage.js";
import { fetchReviewMemoryImageFromWordbase } from "./reviewWordbaseMemory.js";

export const IMAGE_PREFETCH_EXTRA_LIMIT = 12;

function applyWordChanges(words, wordId, changes) {
  return words.map((word) => (word.id === wordId ? { ...word, ...changes } : word));
}

export function buildImagePrefetchQueue(
  sessionWords,
  allWords,
  extraLimit = IMAGE_PREFETCH_EXTRA_LIMIT,
) {
  const queue = [...sessionWords];
  const queuedIds = new Set(sessionWords.map((word) => word.id));

  for (const word of allWords) {
    if (queue.length >= sessionWords.length + extraLimit) {
      break;
    }

    if (!queuedIds.has(word.id)) {
      queue.push(word);
      queuedIds.add(word.id);
    }
  }

  return queue;
}

async function fetchWordImageIntoPool(word, workingWords, { updateWord } = {}) {
  const result = await fetchReviewMemoryImageFromWordbase(word, { updateWord });

  if (result.wordbaseMiss || !result.memoryImage) {
    return workingWords;
  }

  const changes = result.changes ?? buildWordMemoryImageChanges(result.memoryImage);

  if (updateWord) {
    await updateWord(word.id, changes);
  }

  return applyWordChanges(workingWords, word.id, changes);
}

export async function prefetchImageReviewPool(
  sessionWords,
  allWords,
  { onProgress, updateWord } = {},
) {
  let workingWords = allWords;
  const queue = buildImagePrefetchQueue(sessionWords, allWords);
  let sessionProgress = 0;

  for (let index = 0; index < queue.length; index += 1) {
    const word = queue[index];
    const currentWord = workingWords.find((item) => item.id === word.id) ?? word;

    if (!wordHasMemoryImage(currentWord)) {
      workingWords = await fetchWordImageIntoPool(word, workingWords, {
        updateWord,
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
