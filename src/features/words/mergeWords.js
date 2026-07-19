import { hasMemoryImageUrl } from "./memoryImageUtils.js";
import { normalizeTerm } from "./wordTypes.js";

function timestampMs(value) {
  return Date.parse(value || "") || 0;
}

function getReviewTimestamp(word) {
  return Math.max(
    timestampMs(word?.review?.lastReviewedAt),
    timestampMs(word?.updatedAt),
  );
}

function getMistakeTimestamp(word) {
  return Math.max(
    timestampMs(word?.mistake?.lastMistakeAt),
    timestampMs(word?.review?.lastReviewedAt),
    timestampMs(word?.updatedAt),
  );
}

function pickFresherField(remoteWord, localWord, fieldName, getTimestamp) {
  const localValue = localWord?.[fieldName];
  const remoteValue = remoteWord?.[fieldName];

  if (!localValue) {
    return remoteValue;
  }

  if (!remoteValue) {
    return localValue;
  }

  return getTimestamp(localWord) > getTimestamp(remoteWord) ? localValue : remoteValue;
}

export function mergeWordsPreservingMemory(remoteWords, existingWords) {
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
      review: pickFresherField(word, existing, "review", getReviewTimestamp),
      mistake: pickFresherField(word, existing, "mistake", getMistakeTimestamp),
      memoryTipsByLocale: {
        ...(existing.memoryTipsByLocale ?? {}),
        ...(word.memoryTipsByLocale ?? {}),
      },
      memoryImage: hasMemoryImageUrl(word.memoryImage)
        ? word.memoryImage
        : (hasMemoryImageUrl(existing.memoryImage)
          ? existing.memoryImage
          : (word.memoryImage ?? existing.memoryImage ?? null)),
    };
  });

  const localOnlyWords = existingWords.filter(
    (word) => !remoteTerms.has(normalizeTerm(word.term)),
  );

  return [...mergedRemote, ...localOnlyWords];
}
