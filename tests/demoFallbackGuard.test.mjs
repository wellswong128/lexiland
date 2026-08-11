import assert from "node:assert/strict";
import test from "node:test";
import {
  hasDemoFallbackTag,
  shouldBlockDemoFallbackSave,
} from "../src/features/words/demoFallbackGuard.js";

test("demo fallback tags are detected in form tag strings", () => {
  assert.equal(hasDemoFallbackTag("demo, ai-fallback"), true);
  assert.equal(hasDemoFallbackTag("Demo, AI-Fallback "), true);
  assert.equal(hasDemoFallbackTag("review, spelling"), false);
});

test("manual add saves are blocked only for pending fallback completions", () => {
  const fallbackForm = {
    term: "resilient",
    definition: 'A demo vocabulary card for "resilient".',
    tags: "demo, ai-fallback",
  };

  assert.equal(shouldBlockDemoFallbackSave(fallbackForm, true), true);
  assert.equal(shouldBlockDemoFallbackSave(fallbackForm, false), false);
  assert.equal(
    shouldBlockDemoFallbackSave({ ...fallbackForm, tags: "exam, review" }, true),
    false,
  );
});
