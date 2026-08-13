import assert from "node:assert/strict";
import test from "node:test";
import {
  clearReviewSession,
  loadReviewSession,
  loadReviewSessionForWordIds,
  saveReviewSession,
} from "../src/lib/reviewSessionStorage.js";

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

test("loadReviewSessionForWordIds preserves a session that belongs to the current words", () => {
  const storage = createMemoryStorage();
  const wordIds = ["word-a", "word-b"];

  saveReviewSession(
    { totalCount: 2, wordIds },
    storage,
  );
  const before = loadReviewSession(storage);

  const session = loadReviewSessionForWordIds(wordIds, storage);

  assert.deepEqual(session, before);
  assert.deepEqual(loadReviewSession(storage), before);
});

test("loadReviewSessionForWordIds clears a session from another account", () => {
  const storage = createMemoryStorage();

  saveReviewSession({ totalCount: 2, wordIds: ["word-a", "word-old"] }, storage);

  const session = loadReviewSessionForWordIds(["word-b", "word-c"], storage);

  assert.equal(session, null);
  assert.equal(loadReviewSession(storage), null);
});

test("loadReviewSessionForWordIds clears a stale session when the current account has no words", () => {
  const storage = createMemoryStorage();

  saveReviewSession({ totalCount: 1, wordIds: ["word-a"] }, storage);

  const session = loadReviewSessionForWordIds([], storage);

  assert.equal(session, null);
  assert.equal(loadReviewSession(storage), null);
  clearReviewSession(storage);
});
