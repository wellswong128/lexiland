import { readWordMemoryImage } from "../words/wordImageApi.js";
import { fetchWordMemoryWithCache } from "../words/wordMemoryApi.js";
import { hasMemoryImageUrl, normalizeMemoryImage } from "../words/memoryImageUtils.js";
import { buildWordMemoryImageChanges } from "../../lib/wordAiMemoryStorage.js";

export function wordNeedsWordbaseMemoryImage(word, locale = "zh-Hant") {
  return !hasMemoryImageUrl(readWordMemoryImage(word));
}

export async function applyWordbaseMemoryToWord(
  word,
  { locale = "zh-Hant", updateWord, user } = {},
) {
  const result = await fetchWordMemoryWithCache(word, locale, {
    user,
    wordbaseOnly: true,
  });

  const memoryImage = normalizeMemoryImage(result?.memoryImage ?? result);
  let changes = result?.changes ?? null;

  if (memoryImage && !changes?.memoryImage?.imageUrl) {
    changes = {
      ...(changes ?? {}),
      ...buildWordMemoryImageChanges(memoryImage),
    };
  }

  if (changes && updateWord) {
    await updateWord(word.id, changes);
  }

  return {
    ...result,
    changes,
    memoryImage,
  };
}
