import { fetchUserActiveGroupWords } from "./wordGroupsApi.js";
import { normalizeTerm } from "../words/wordTypes.js";
import { loadWordScopeMode, WORD_SCOPE_MODES } from "./wordScopeMode.js";

function stripSavedAt(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  const { savedAt: _savedAt, ...rest } = value;
  return rest;
}

function hasMemoryTipsValue(value) {
  const tips = stripSavedAt(value);
  return Array.isArray(tips?.tips) && tips.tips.some(
    (tip) => String(tip?.method ?? "").trim() && String(tip?.content ?? "").trim(),
  );
}

function wordHasMemoryTips(word, locale) {
  return hasMemoryTipsValue(word.memoryTipsByLocale?.[locale]);
}

function wordHasMemoryImage(word) {
  return Boolean(String(word.memoryImage?.imageUrl ?? "").trim());
}

export function buildWordMemoryChangesFromMapped(word, mappedWord) {
  const changes = {};
  let dirty = false;
  const mergedTips = { ...(word.memoryTipsByLocale ?? {}) };

  for (const [locale, tips] of Object.entries(mappedWord.memoryTipsByLocale ?? {})) {
    if (wordHasMemoryTips(word, locale) || !hasMemoryTipsValue(tips)) {
      continue;
    }

    mergedTips[locale] = stripSavedAt(tips);
    dirty = true;
  }

  if (dirty) {
    changes.memoryTipsByLocale = mergedTips;
  }

  if (!wordHasMemoryImage(word) && mappedWord.memoryImage?.imageUrl) {
    changes.memoryImage = stripSavedAt(mappedWord.memoryImage);
    dirty = true;
  }

  return dirty ? changes : null;
}

export async function syncActiveGroupWordMemory(
  userWords,
  updateWord,
  userId,
  preloadedMappedWords = null,
  { batchUpdater = null } = {},
) {
  if (!userId || !Array.isArray(userWords) || userWords.length === 0) {
    return 0;
  }

  if (loadWordScopeMode(userId) !== WORD_SCOPE_MODES.GROUP) {
    return 0;
  }

  let mappedWords = preloadedMappedWords;
  if (!Array.isArray(mappedWords)) {
    const payload = await fetchUserActiveGroupWords({
      includeWords: true,
      wordLimit: 0,
    });
    if (!payload.activeGroup) {
      return 0;
    }
    mappedWords = payload.mappedWords;
  }

  if (!Array.isArray(mappedWords) || mappedWords.length === 0) {
    return 0;
  }

  const mappedByTerm = new Map(
    mappedWords
      .map((mappedWord) => [normalizeTerm(mappedWord.term), mappedWord])
      .filter(([termKey]) => Boolean(termKey)),
  );

  const pendingUpdates = [];

  for (const word of userWords) {
    const mappedWord = mappedByTerm.get(normalizeTerm(word.term));
    if (!mappedWord) {
      continue;
    }

    const changes = buildWordMemoryChangesFromMapped(word, mappedWord);
    if (!changes) {
      continue;
    }

    pendingUpdates.push({ wordId: word.id, word, changes });
  }

  if (pendingUpdates.length === 0) {
    return 0;
  }

  if (batchUpdater) {
    await batchUpdater(pendingUpdates);
    return pendingUpdates.length;
  }

  for (const { wordId, changes } of pendingUpdates) {
    await updateWord(wordId, changes);
  }

  return pendingUpdates.length;
}
