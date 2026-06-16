import { fetchWordImageWithCache } from "../words/wordImageApi.js";

export async function prefetchSessionMemoryImages(sessionWords, { onProgress, updateWord, user }) {
  let completed = 0;

  for (const word of sessionWords) {
    const result = await fetchWordImageWithCache(word, { user });

    if (result.changes) {
      await updateWord(word.id, result.changes);
    }

    completed += 1;
    onProgress?.(completed, sessionWords.length);
  }
}
