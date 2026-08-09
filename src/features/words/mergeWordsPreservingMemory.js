import { normalizeTerm } from "./wordTypes.js";

export function mergeWordsPreservingMemory(
  remoteWords,
  existingWords,
  { includeLocalOnly = true } = {},
) {
  if (!Array.isArray(existingWords) || existingWords.length === 0) {
    return remoteWords;
  }

  const existingById = new Map(existingWords.map((word) => [word.id, word]));
  const remoteTerms = new Set(
    remoteWords.map((word) => normalizeTerm(word.term)).filter(Boolean),
  );

  const mergedRemote = remoteWords.map((word) => {
    const existing = existingById.get(word.id);
    if (!existing) {
      return word;
    }

    return {
      ...word,
      memoryTipsByLocale: {
        ...(existing.memoryTipsByLocale ?? {}),
        ...(word.memoryTipsByLocale ?? {}),
      },
      memoryImage: word.memoryImage?.imageUrl
        ? word.memoryImage
        : (existing.memoryImage?.imageUrl ? existing.memoryImage : (word.memoryImage ?? existing.memoryImage ?? null)),
    };
  });

  if (!includeLocalOnly) {
    return mergedRemote;
  }

  const localOnlyWords = existingWords.filter(
    (word) => !remoteTerms.has(normalizeTerm(word.term)),
  );

  return [...mergedRemote, ...localOnlyWords];
}
