import assert from "node:assert/strict";
import test from "node:test";
import { createScopedPayloadCache } from "../src/features/wordGroups/activeGroupWordsCache.js";

function createPayload(groupCode, mappedWords = []) {
  return {
    activeGroup: {
      groupCode,
      displayNameEn: `Group ${groupCode}`,
    },
    mappedTerms: [`${groupCode}-term`],
    mappedWords,
  };
}

test("active-group cache entries are isolated by user scope", () => {
  let currentTime = 1_000;
  const cache = createScopedPayloadCache({
    now: () => currentTime,
    ttlMs: 60_000,
  });

  cache.writeFull("user:a", createPayload("A", [{ id: "word-a", term: "apple" }]));
  currentTime += 1_000;

  assert.equal(cache.read("user:b", { includeWords: true }), null);
  assert.equal(cache.read("user:b", { includeWords: false }), null);

  assert.deepEqual(cache.read("user:a", { includeWords: false }), {
    activeGroup: {
      groupCode: "A",
      displayNameEn: "Group A",
    },
    mappedTerms: ["A-term"],
  });
});

test("in-flight active-group requests are not shared across user scopes", async () => {
  const cache = createScopedPayloadCache();
  const userARequest = Promise.resolve(createPayload("A"));

  cache.trackInflight("user:a", "full", userARequest);

  assert.equal(cache.readInflight("user:b", "full"), null);
  assert.equal(cache.readInflight("user:a", "full"), userARequest);

  await userARequest;
});
