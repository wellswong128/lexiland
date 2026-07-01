import { readWordMemoryTips, persistWordMemoryTips } from "../words/memoryTipsApi.js";
import { readWordMemoryImage, persistWordMemoryImage } from "../words/wordImageApi.js";
import {
  canUseWordbase,
  fetchWordbaseEntry,
  hasWordbaseMemoryImage,
  hasWordbaseMemoryTips,
} from "../words/wordbaseApi.js";
import { hasMemoryImageUrl, normalizeMemoryImage } from "../words/memoryImageUtils.js";
import { buildWordMemoryImageChanges } from "../../lib/wordAiMemoryStorage.js";

function stripSavedAt(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  const { savedAt: _savedAt, ...rest } = value;
  return rest;
}

function mergeReviewMemoryChanges(...changeSets) {
  return changeSets.reduce((merged, changes) => {
    if (!changes) {
      return merged;
    }

    return {
      ...merged,
      ...changes,
      memoryTipsByLocale: {
        ...(merged.memoryTipsByLocale ?? {}),
        ...(changes.memoryTipsByLocale ?? {}),
      },
      memoryImage:
        Object.hasOwn(changes, "memoryImage") ? changes.memoryImage : merged.memoryImage,
    };
  }, {});
}

async function readWordbaseMemoryEntry(word, locale, user) {
  if (!canUseWordbase(user)) {
    return { memoryTips: null, memoryImage: null };
  }

  try {
    const entry = await fetchWordbaseEntry(word.term);

    if (!entry) {
      return { memoryTips: null, memoryImage: null };
    }

    return {
      memoryTips: hasWordbaseMemoryTips(entry, locale)
        ? stripSavedAt(entry.memoryTipsByLocale[locale])
        : null,
      memoryImage: hasWordbaseMemoryImage(entry)
        ? stripSavedAt(normalizeMemoryImage(entry.memoryImage))
        : null,
    };
  } catch (error) {
    console.warn("Could not read review memory from wordbase.", word.term, error);
    return { memoryTips: null, memoryImage: null };
  }
}

export function reviewWordNeedsMemoryImage(word) {
  return !hasMemoryImageUrl(readWordMemoryImage(word));
}

export async function fetchReviewMemoryImageFromWordbase(word, { user } = {}) {
  const savedImage = readWordMemoryImage(word);

  if (hasMemoryImageUrl(savedImage)) {
    return {
      memoryImage: savedImage,
      changes: null,
      fromCache: true,
      fromWordbase: false,
      wordbaseMiss: false,
    };
  }

  const wordbaseMemory = await readWordbaseMemoryEntry(word, "zh-Hant", user);
  const memoryImage = wordbaseMemory.memoryImage;

  if (!hasMemoryImageUrl(memoryImage)) {
    return {
      memoryImage: null,
      changes: null,
      fromCache: false,
      fromWordbase: false,
      wordbaseMiss: true,
    };
  }

  const changes = persistWordMemoryImage(word, memoryImage);

  return {
    memoryImage,
    changes,
    fromCache: false,
    fromWordbase: true,
    wordbaseMiss: false,
  };
}

export async function applyReviewMemoryFromWordbase(
  word,
  { locale = "zh-Hant", updateWord, user } = {},
) {
  const savedTips = readWordMemoryTips(word, locale);
  const savedImage = readWordMemoryImage(word);
  let memoryTips = savedTips;
  let memoryImage = savedImage;
  const changeList = [];

  if (!savedTips || !hasMemoryImageUrl(savedImage)) {
    const wordbaseMemory = await readWordbaseMemoryEntry(word, locale, user);

    if (!savedTips && wordbaseMemory.memoryTips) {
      memoryTips = wordbaseMemory.memoryTips;
    }

    if (!hasMemoryImageUrl(savedImage) && hasMemoryImageUrl(wordbaseMemory.memoryImage)) {
      memoryImage = wordbaseMemory.memoryImage;
    }
  }

  if (!savedTips && memoryTips) {
    changeList.push(persistWordMemoryTips(word, locale, memoryTips));
  }

  if (!hasMemoryImageUrl(savedImage) && hasMemoryImageUrl(memoryImage)) {
    changeList.push(persistWordMemoryImage(word, memoryImage));
  }

  let changes = mergeReviewMemoryChanges(...changeList);

  if (hasMemoryImageUrl(memoryImage) && !changes?.memoryImage?.imageUrl) {
    changes = {
      ...changes,
      ...buildWordMemoryImageChanges(memoryImage),
    };
  }

  const stillNeedsTips = !memoryTips;
  const stillNeedsImage = !hasMemoryImageUrl(memoryImage);

  if (changes && Object.keys(changes).length > 0 && updateWord) {
    await updateWord(word.id, changes);
  }

  return {
    memoryTips,
    memoryImage,
    changes: Object.keys(changes).length > 0 ? changes : null,
    wordbaseMiss: stillNeedsTips || stillNeedsImage,
  };
}

// Backwards-compatible aliases used by review prefetch helpers.
export const wordNeedsWordbaseMemoryImage = reviewWordNeedsMemoryImage;
export const applyWordbaseMemoryToWord = applyReviewMemoryFromWordbase;
