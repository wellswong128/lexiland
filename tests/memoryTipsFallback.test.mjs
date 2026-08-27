import assert from "node:assert/strict";
import test from "node:test";

import { createFallbackMemoryTipsResult } from "../src/features/words/memoryTipsFallback.js";

test("memory tips API fallback stays display-only", () => {
  const word = {
    id: "word-1",
    term: "photosynthesis",
    example: "Plants use photosynthesis to make food.",
    memoryTipsByLocale: {},
  };
  const result = createFallbackMemoryTipsResult(
    word,
    "en",
    new Error("AI service timed out."),
  );

  assert.equal(result.usedFallback, true);
  assert.equal(result.fallbackReason, "AI service timed out.");
  assert.equal(result.fromCache, false);
  assert.equal(result.fromWordbase, false);
  assert.equal(result.changes, null);
  assert.match(result.memoryTips.summary, /photosynthesis/);
  assert.ok(Array.isArray(result.memoryTips.tips));
  assert.ok(result.memoryTips.tips.length > 0);
});
