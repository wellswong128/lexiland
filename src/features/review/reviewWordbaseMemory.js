import { readWordMemoryImage } from "../words/wordImageApi.js";
import { hasMemoryImageUrl } from "../words/memoryImageUtils.js";
import { buildWordMemoryImageChanges } from "../../lib/wordAiMemoryStorage.js";

export function reviewWordNeedsMemoryImage(word) {
  return !hasMemoryImageUrl(readWordMemoryImage(word));
}

export function readReviewMemoryImage(word) {
  return readWordMemoryImage(word);
}

/**
 * Review flows must not call AI or per-word Wordbase APIs.
 * Images are expected on the word row (or local storage) after batch sync/import.
 */
export async function applyReviewMemoryImageLocally(word, { updateWord } = {}) {
  const memoryImage = readWordMemoryImage(word);

  if (!hasMemoryImageUrl(memoryImage)) {
    return {
      memoryImage: null,
      changes: null,
      fromCache: false,
      wordbaseMiss: true,
    };
  }

  let changes = null;

  if (!hasMemoryImageUrl(word.memoryImage) && updateWord) {
    changes = buildWordMemoryImageChanges(memoryImage);
    await updateWord(word.id, changes);
  }

  return {
    memoryImage,
    changes,
    fromCache: true,
    wordbaseMiss: false,
  };
}

export async function fetchReviewMemoryImageFromWordbase(word, options = {}) {
  return applyReviewMemoryImageLocally(word, options);
}

export async function applyReviewMemoryFromWordbase(word, options = {}) {
  return applyReviewMemoryImageLocally(word, options);
}

export const wordNeedsWordbaseMemoryImage = reviewWordNeedsMemoryImage;
export const applyWordbaseMemoryToWord = applyReviewMemoryImageLocally;
