import { readWordMemoryTips, fetchMemoryTipsWithFallback } from "./memoryTipsApi.js";
import {
  fetchWordImageWithCache,
  readWordMemoryImage,
} from "./wordImageApi.js";

export function readWordMemory(word, locale) {
  return {
    memoryTips: readWordMemoryTips(word, locale),
    memoryImage: readWordMemoryImage(word),
  };
}

function mergeChanges(...changeSets) {
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

export async function fetchWordMemoryWithCache(
  word,
  locale,
  { forceRefresh = false } = {},
) {
  const savedTips = readWordMemoryTips(word, locale);
  const savedImage = readWordMemoryImage(word);
  const hasTips = Boolean(savedTips);
  const hasImage = Boolean(savedImage?.imageUrl);

  if (!forceRefresh && hasTips && hasImage) {
    return {
      memoryTips: savedTips,
      memoryImage: savedImage,
      fromCache: true,
      usedFallback: false,
    };
  }

  const shouldRefreshTips = forceRefresh || !hasTips;
  const shouldRefreshImage = forceRefresh || !hasImage;
  let memoryTips = savedTips;
  let memoryImage = savedImage;
  let usedFallback = false;
  let fallbackReason = "";
  let tipsFromCache = !shouldRefreshTips;
  let imageFromCache = !shouldRefreshImage;
  let imageError = null;
  const changeList = [];

  const tasks = [];

  if (shouldRefreshTips) {
    tasks.push(
      fetchMemoryTipsWithFallback(word, locale, { forceRefresh: true }).then((result) => {
        memoryTips = result.memoryTips;
        usedFallback = result.usedFallback;
        fallbackReason = result.fallbackReason ?? "";
        tipsFromCache = false;

        if (result.changes) {
          changeList.push(result.changes);
        }
      }),
    );
  }

  if (shouldRefreshImage) {
    tasks.push(
      fetchWordImageWithCache(word, { forceRefresh: true })
        .then((result) => {
          memoryImage = result;
          imageFromCache = Boolean(result.fromCache);
          changeList.push(result.changes);
        })
        .catch((error) => {
          imageError = error.message;
          imageFromCache = false;
        }),
    );
  }

  await Promise.all(tasks);

  const changes = mergeChanges(...changeList);

  return {
    memoryTips,
    memoryImage,
    usedFallback,
    fallbackReason,
    fromCache: tipsFromCache && imageFromCache && !imageError,
    changes: Object.keys(changes).length > 0 ? changes : null,
    imageError,
  };
}
