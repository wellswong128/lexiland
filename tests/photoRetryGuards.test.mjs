import assert from "node:assert/strict";
import test from "node:test";

import { assertRealPhotoCompletion } from "../src/features/words/photoRetryGuards.js";

test("assertRealPhotoCompletion returns non-fallback completion results", () => {
  const result = {
    suggestion: {
      term: "resilient",
      definition: "Able to recover quickly.",
    },
    usedFallback: false,
  };

  assert.equal(assertRealPhotoCompletion(result), result);
});

test("assertRealPhotoCompletion rejects demo fallback retry results", () => {
  const result = {
    suggestion: {
      term: "resilient",
      definition: "Demo fallback definition.",
    },
    usedFallback: true,
    fallbackReason: "AI service timed out. Please try again.",
  };

  assert.throws(
    () => assertRealPhotoCompletion(result),
    /AI service timed out/,
  );
});

test("assertRealPhotoCompletion rejects fallback results without a reason", () => {
  assert.throws(
    () => assertRealPhotoCompletion({ usedFallback: true }),
    /demo fallback data/,
  );
});
