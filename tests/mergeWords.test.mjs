import assert from "node:assert/strict";
import { test } from "node:test";

import { mergeWordsPreservingMemory } from "../src/features/words/mergeWords.js";

function makeWord(overrides = {}) {
  return {
    id: "word-1",
    term: "apple",
    definition: "A fruit",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    review: {
      level: 0,
      nextReviewAt: "2026-07-01T00:00:00.000Z",
      lastReviewedAt: null,
      correctCount: 0,
      incorrectCount: 0,
      lastResult: null,
    },
    mistake: {
      isMistake: false,
      lastMistakeAt: null,
      mistakeCount: 0,
    },
    memoryTipsByLocale: {},
    memoryImage: null,
    ...overrides,
  };
}

test("mergeWordsPreservingMemory keeps fresher local review and mistake progress", () => {
  const remoteWord = makeWord({
    updatedAt: "2026-07-01T00:00:00.000Z",
    review: {
      level: 1,
      nextReviewAt: "2026-07-02T00:00:00.000Z",
      lastReviewedAt: "2026-07-01T00:00:00.000Z",
      correctCount: 1,
      incorrectCount: 0,
      lastResult: "correct",
    },
    mistake: {
      isMistake: true,
      lastMistakeAt: "2026-07-01T00:00:00.000Z",
      mistakeCount: 1,
    },
    memoryTipsByLocale: { en: "remote tip" },
  });
  const localWord = makeWord({
    updatedAt: "2026-07-01T00:00:02.000Z",
    review: {
      level: 2,
      nextReviewAt: "2026-07-04T00:00:00.000Z",
      lastReviewedAt: "2026-07-01T00:00:02.000Z",
      correctCount: 2,
      incorrectCount: 0,
      lastResult: "remembered",
    },
    mistake: {
      isMistake: false,
      lastMistakeAt: "2026-07-01T00:00:00.000Z",
      mistakeCount: 1,
    },
    memoryTipsByLocale: { zh: "local tip" },
    memoryImage: { imageUrl: "https://example.test/apple.png" },
  });

  const [merged] = mergeWordsPreservingMemory([remoteWord], [localWord]);

  assert.equal(merged.review.level, 2);
  assert.equal(merged.mistake.isMistake, false);
  assert.deepEqual(merged.memoryTipsByLocale, {
    zh: "local tip",
    en: "remote tip",
  });
  assert.equal(merged.memoryImage.imageUrl, "https://example.test/apple.png");
});

test("mergeWordsPreservingMemory keeps newer remote learning progress", () => {
  const remoteWord = makeWord({
    updatedAt: "2026-07-01T00:00:05.000Z",
    review: {
      level: 3,
      nextReviewAt: "2026-07-08T00:00:00.000Z",
      lastReviewedAt: "2026-07-01T00:00:05.000Z",
      correctCount: 3,
      incorrectCount: 0,
      lastResult: "correct",
    },
  });
  const localWord = makeWord({
    updatedAt: "2026-07-01T00:00:02.000Z",
    review: {
      level: 2,
      nextReviewAt: "2026-07-04T00:00:00.000Z",
      lastReviewedAt: "2026-07-01T00:00:02.000Z",
      correctCount: 2,
      incorrectCount: 0,
      lastResult: "remembered",
    },
  });

  const [merged] = mergeWordsPreservingMemory([remoteWord], [localWord]);

  assert.equal(merged.review.level, 3);
  assert.equal(merged.review.correctCount, 3);
});
