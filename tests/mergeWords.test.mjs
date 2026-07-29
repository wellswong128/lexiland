import assert from "node:assert/strict";
import test from "node:test";

import { mergeWordsPreservingMemory } from "../src/features/words/useWords.js";

function makeWord(overrides = {}) {
  return {
    id: "word-1",
    term: "Resilient",
    definition: "Remote definition",
    translation: "",
    pronunciation: "",
    partOfSpeech: "",
    example: "",
    exampleTranslation: "",
    notes: "",
    tags: [],
    source: "manual",
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

test("merge preserves newer cached review and mistake progress over stale remote row", () => {
  const remote = makeWord({
    definition: "Fresh remote dictionary field",
    updatedAt: "2026-07-01T00:00:00.000Z",
    memoryTipsByLocale: { "zh-Hant": { tips: [{ method: "remote", content: "remote" }] } },
  });
  const cached = makeWord({
    updatedAt: "2026-07-02T00:00:00.000Z",
    review: {
      level: 4,
      nextReviewAt: "2026-07-09T00:00:00.000Z",
      lastReviewedAt: "2026-07-02T00:00:00.000Z",
      correctCount: 7,
      incorrectCount: 1,
      lastResult: "correct",
    },
    mistake: {
      isMistake: true,
      lastMistakeAt: "2026-07-02T00:00:00.000Z",
      mistakeCount: 2,
    },
    memoryTipsByLocale: { "zh-Hans": { tips: [{ method: "local", content: "local" }] } },
  });

  const [merged] = mergeWordsPreservingMemory([remote], [cached]);

  assert.equal(merged.definition, "Fresh remote dictionary field");
  assert.equal(merged.review.level, 4);
  assert.equal(merged.review.correctCount, 7);
  assert.equal(merged.mistake.isMistake, true);
  assert.equal(merged.mistake.mistakeCount, 2);
  assert.deepEqual(Object.keys(merged.memoryTipsByLocale).sort(), ["zh-Hans", "zh-Hant"]);
});

test("merge keeps newer remote learning progress when cached state is stale", () => {
  const remote = makeWord({
    updatedAt: "2026-07-03T00:00:00.000Z",
    review: {
      level: 5,
      nextReviewAt: "2026-07-10T00:00:00.000Z",
      lastReviewedAt: "2026-07-03T00:00:00.000Z",
      correctCount: 10,
      incorrectCount: 0,
      lastResult: "correct",
    },
  });
  const cached = makeWord({
    updatedAt: "2026-07-01T00:00:00.000Z",
    review: {
      level: 1,
      nextReviewAt: "2026-07-02T00:00:00.000Z",
      lastReviewedAt: "2026-07-01T00:00:00.000Z",
      correctCount: 1,
      incorrectCount: 0,
      lastResult: "correct",
    },
  });

  const [merged] = mergeWordsPreservingMemory([remote], [cached]);

  assert.equal(merged.review.level, 5);
  assert.equal(merged.review.correctCount, 10);
});

test("merge preserves cached progress for same-term rows with different ids", () => {
  const remote = makeWord({ id: "remote-id", term: "resilient" });
  const cached = makeWord({
    id: "local-id",
    term: "Resilient",
    updatedAt: "2026-07-04T00:00:00.000Z",
    review: {
      level: 3,
      nextReviewAt: "2026-07-08T00:00:00.000Z",
      lastReviewedAt: "2026-07-04T00:00:00.000Z",
      correctCount: 4,
      incorrectCount: 1,
      lastResult: "correct",
    },
  });

  const merged = mergeWordsPreservingMemory([remote], [cached]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, "remote-id");
  assert.equal(merged[0].review.level, 3);
});
