import assert from "node:assert/strict";
import { test } from "node:test";

import { getImmediateImageReviewResult } from "../src/features/review/flashcardGrading.js";
import { REVIEW_RESULTS } from "../src/features/words/wordTypes.js";

test("correct image answers are graded immediately", () => {
  assert.equal(
    getImmediateImageReviewResult("word-1", "word-1"),
    REVIEW_RESULTS.REMEMBERED,
  );
});

test("wrong image answers defer grading until explicit recall choice", () => {
  assert.equal(getImmediateImageReviewResult("word-2", "word-1"), null);
});
