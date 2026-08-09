import assert from "node:assert/strict";
import test from "node:test";

import { mergeWordsPreservingMemory } from "../src/features/words/mergeWordsPreservingMemory.js";

function makeWord(overrides) {
  return {
    id: "word-1",
    term: "apple",
    definition: "A fruit",
    memoryTipsByLocale: {},
    memoryImage: null,
    ...overrides,
  };
}

test("drops previous account local-only words when no current-user cache exists", () => {
  const remoteWords = [
    makeWord({
      id: "user-b-remote",
      term: "banana",
      definition: "A yellow fruit",
    }),
  ];
  const previousAccountWords = [
    makeWord({
      id: "user-a-local",
      term: "apple",
      definition: "A red fruit",
    }),
  ];

  const merged = mergeWordsPreservingMemory(remoteWords, previousAccountWords, {
    includeLocalOnly: false,
  });

  assert.deepEqual(
    merged.map((word) => word.term),
    ["banana"],
  );
});

test("preserves current-user cached local-only words when requested", () => {
  const remoteWords = [
    makeWord({
      id: "remote-1",
      term: "banana",
      definition: "A yellow fruit",
    }),
  ];
  const cachedWords = [
    makeWord({
      id: "cached-local",
      term: "apple",
      definition: "A cached local word",
    }),
  ];

  const merged = mergeWordsPreservingMemory(remoteWords, cachedWords, {
    includeLocalOnly: true,
  });

  assert.deepEqual(
    merged.map((word) => word.term),
    ["banana", "apple"],
  );
});

test("keeps local generated memory for matching remote words", () => {
  const remoteWords = [
    makeWord({
      id: "word-1",
      term: "apple",
      memoryTipsByLocale: {
        "zh-Hans": { tips: ["remote"] },
      },
      memoryImage: null,
    }),
  ];
  const cachedWords = [
    makeWord({
      id: "word-1",
      term: "apple",
      memoryTipsByLocale: {
        "zh-Hant": { tips: ["local"] },
      },
      memoryImage: { imageUrl: "local-image.webp" },
    }),
  ];

  const [merged] = mergeWordsPreservingMemory(remoteWords, cachedWords, {
    includeLocalOnly: false,
  });

  assert.deepEqual(merged.memoryTipsByLocale, {
    "zh-Hant": { tips: ["local"] },
    "zh-Hans": { tips: ["remote"] },
  });
  assert.equal(merged.memoryImage.imageUrl, "local-image.webp");
});
