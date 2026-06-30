import { readWordMemoryTips, fetchMemoryTipsWithFallback, persistWordMemoryTips } from "./memoryTipsApi.js";
import {
  fetchWordImageWithCache,
  readWordMemoryImage,
  persistWordMemoryImage,
} from "./wordImageApi.js";
import {
  canUseWordbase,
  contributeMemoryImageToWordbase,
  contributeMemoryTipsToWordbase,
  fetchWordbaseEntry,
  hasWordbaseMemoryImage,
  hasWordbaseMemoryTips,
} from "./wordbaseApi.js";

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

function stripSavedAt(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  const { savedAt: _savedAt, ...rest } = value;

  return rest;
}

async function readWordbaseMemory(word, locale, user) {
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
      memoryImage: hasWordbaseMemoryImage(entry) ? stripSavedAt(entry.memoryImage) : null,
    };
  } catch (wordbaseError) {
    console.warn("Could not read memory assist from wordbase.", wordbaseError);
    return { memoryTips: null, memoryImage: null };
  }
}

export async function fetchWordMemoryWithCache(
  word,
  locale,
  { forceRefresh = false, user } = {},
) {
  const savedTips = readWordMemoryTips(word, locale);
  const savedImage = readWordMemoryImage(word);
  let memoryTips = savedTips;
  let memoryImage = savedImage;
  let tipsFromCache = Boolean(savedTips);
  let imageFromCache = Boolean(savedImage?.imageUrl);

  if (!forceRefresh && canUseWordbase(user) && (!memoryTips || !memoryImage?.imageUrl)) {
    const wordbaseMemory = await readWordbaseMemory(word, locale, user);

    if (!memoryTips && wordbaseMemory.memoryTips) {
      memoryTips = wordbaseMemory.memoryTips;
      tipsFromCache = true;
    }

    if (!memoryImage?.imageUrl && wordbaseMemory.memoryImage) {
      memoryImage = wordbaseMemory.memoryImage;
      imageFromCache = true;
    }
  }

  const hasTips = Boolean(memoryTips);
  const hasImage = Boolean(memoryImage?.imageUrl);
  const changeList = [];

  if (!savedTips && memoryTips) {
    changeList.push(persistWordMemoryTips(word, locale, memoryTips));
  }

  if (!savedImage?.imageUrl && memoryImage?.imageUrl) {
    changeList.push(persistWordMemoryImage(word, memoryImage));
  }

  if (!forceRefresh && hasTips && hasImage) {
    const changes = mergeChanges(...changeList);

    return {
      memoryTips,
      memoryImage,
      fromCache: tipsFromCache && imageFromCache,
      usedFallback: false,
      changes: Object.keys(changes).length > 0 ? changes : null,
    };
  }

  const shouldRefreshTips = forceRefresh || !hasTips;
  const shouldRefreshImage = forceRefresh || !hasImage;
  let usedFallback = false;
  let fallbackReason = "";
  let imageError = null;

  const tasks = [];

  if (shouldRefreshTips) {
    tasks.push(
      fetchMemoryTipsWithFallback(word, locale, { forceRefresh, user }).then((result) => {
        memoryTips = result.memoryTips;
        usedFallback = result.usedFallback;
        fallbackReason = result.fallbackReason ?? "";
        tipsFromCache = Boolean(result.fromCache || result.fromWordbase);

        if (result.changes) {
          changeList.push(result.changes);
        }
      }),
    );
  }

  if (shouldRefreshImage) {
    tasks.push(
      fetchWordImageWithCache(word, { forceRefresh, user })
        .then((result) => {
          memoryImage = result;
          imageFromCache = Boolean(result.fromCache || result.fromWordbase);
          changeList.push(result.changes);
        })
        .catch((error) => {
          imageError = error.message;
          imageFromCache = false;
        }),
    );
  }

  await Promise.all(tasks);

  if (canUseWordbase(user) && !usedFallback && !imageError) {
    try {
      await Promise.all([
        memoryTips
          ? contributeMemoryTipsToWordbase(word, locale, memoryTips, user.id)
          : Promise.resolve(),
        memoryImage?.imageUrl
          ? contributeMemoryImageToWordbase(word, memoryImage, user.id)
          : Promise.resolve(),
      ]);
    } catch (wordbaseError) {
      console.warn("Could not sync memory assist to wordbase.", wordbaseError);
    }
  }

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
