import { createImageQuizQuestions } from "./imageQuizHelpers.js";
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

export async function prefetchImageReviewPool(
  sessionWords,
  allWords,
  { onProgress, updateWord, user } = {},
) {
  let workingWords = allWords;
  const queue = buildPrefetchQueue(sessionWords, allWords);

  for (let index = 0; index < queue.length; index += 1) {
    const word = queue[index];
    const result = await fetchWordImageWithCache(word, { user });

    if (result.changes) {
      workingWords = applyWordChanges(workingWords, word.id, result.changes);
      await updateWord(word.id, result.changes);
    }

    onProgress?.(index + 1, queue.length);

    const questions = createImageQuizQuestions(sessionWords, workingWords);

    if (questions.length > 0) {
      return { questions, words: workingWords };
    }
  }

  return {
    questions: createImageQuizQuestions(sessionWords, workingWords),
    words: workingWords,
  };
}
