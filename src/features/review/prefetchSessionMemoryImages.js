import { fetchWordImageWithCache, readWordMemoryImage } from "../words/wordImageApi.js";

export async function prefetchSessionMemoryImages(sessionWords, { onProgress, updateWord, user }) {
  const queue = sessionWords.filter((word) => !readWordMemoryImage(word)?.imageUrl);
  let completed = 0;

  for (const word of queue) {
    const result = await fetchWordImageWithCache(word, { user });

    if (result.changes) {
      await updateWord(word.id, result.changes);
    }

    completed += 1;
    onProgress?.(completed, queue.length);
  }
}
