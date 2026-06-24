import { createImageQuizQuestions, wordHasMemoryImage } from "./imageQuizHelpers.js";
import { fetchWordImageWithCache } from "../words/wordImageApi.js";

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
  const result = await fetchWordImageWithCache(word, { user });

  if (!result.changes) {
    return workingWords;
  }

  const nextWords = applyWordChanges(workingWords, word.id, result.changes);
  await updateWord(word.id, result.changes);

  return nextWords;
}

export async function prefetchImageReviewPool(
  sessionWords,
  allWords,
  { onProgress, updateWord, user } = {},
) {
  let workingWords = allWords;
  const queue = buildPrefetchQueue(sessionWords, allWords);

  for (let index = 0; index < sessionWords.length; index += 1) {
    const word = sessionWords[index];
    workingWords = await fetchWordImageIntoPool(word, workingWords, { updateWord, user });
    onProgress?.(index + 1, sessionWords.length);
  }

  let questions = createImageQuizQuestions(sessionWords, workingWords);

  if (questions.length > 0) {
    return { questions, words: workingWords };
  }

  for (let index = sessionWords.length; index < queue.length; index += 1) {
    const word = queue[index];
    const currentWord = workingWords.find((item) => item.id === word.id) ?? word;

    if (wordHasMemoryImage(currentWord)) {
      continue;
    }

    workingWords = await fetchWordImageIntoPool(word, workingWords, { updateWord, user });
    onProgress?.(index + 1, queue.length);

    questions = createImageQuizQuestions(sessionWords, workingWords);

    if (questions.length > 0) {
      return { questions, words: workingWords };
    }
  }

  return {
    questions: createImageQuizQuestions(sessionWords, workingWords),
    words: workingWords,
  };
}
