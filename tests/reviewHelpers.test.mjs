import assert from "node:assert/strict";
import test from "node:test";

import {
  getReviewSessionWords,
  updateReviewResult,
} from "../src/features/review/reviewHelpers.js";
import { REVIEW_RESULTS } from "../src/features/words/wordTypes.js";

test("updateReviewResult handles legacy words without review or mistake state", () => {
  const now = new Date("2026-07-05T12:00:00.000Z");
  const result = updateReviewResult(
    {
      id: "legacy-word",
      term: "legacy",
      definition: "Stored before review metadata existed.",
    },
    REVIEW_RESULTS.CORRECT,
    now,
  );

  assert.equal(result.review.level, 1);
  assert.equal(result.review.correctCount, 1);
  assert.equal(result.review.incorrectCount, 0);
  assert.equal(result.review.lastReviewedAt, "2026-07-05T12:00:00.000Z");
  assert.equal(result.mistake.isMistake, false);
});

test("mistakes-only review sessions ignore words without mistake state", () => {
  const session = getReviewSessionWords(
    [
      { id: "legacy-word", term: "legacy", definition: "No mistake state." },
      {
        id: "mistake-word",
        term: "missed",
        definition: "Has mistake state.",
        mistake: { isMistake: true },
      },
    ],
    { mistakesOnly: true },
  );

  assert.deepEqual(
    session.sessionWords.map((word) => word.id),
    ["mistake-word"],
  );
});
