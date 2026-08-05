import assert from "node:assert/strict";
import test from "node:test";

import {
  getCompletionRetryFailureReason,
  isUsableCompletionRetryResult,
} from "../src/features/words/completionRetryGuards.js";

test("completion retry guard accepts real AI suggestions", () => {
  assert.equal(
    isUsableCompletionRetryResult({
      suggestion: {
        term: "ocean",
        definition: "A large body of salt water.",
      },
      usedFallback: false,
    }),
    true,
  );
});

test("completion retry guard rejects demo fallback suggestions", () => {
  const result = {
    suggestion: {
      term: "ocean",
      definition: 'A demo vocabulary card for "ocean".',
    },
    usedFallback: true,
    fallbackReason: "AI service timed out.",
  };

  assert.equal(isUsableCompletionRetryResult(result), false);
  assert.equal(getCompletionRetryFailureReason(result), "AI service timed out.");
});

test("completion retry guard rejects missing suggestions", () => {
  assert.equal(isUsableCompletionRetryResult({ usedFallback: false }), false);
  assert.equal(
    getCompletionRetryFailureReason({}, "Could not complete word."),
    "Could not complete word.",
  );
});

test("completion retry guard rejects ambiguous results without explicit fallback state", () => {
  assert.equal(
    isUsableCompletionRetryResult({
      suggestion: {
        term: "ocean",
        definition: "A large body of salt water.",
      },
    }),
    false,
  );
});
