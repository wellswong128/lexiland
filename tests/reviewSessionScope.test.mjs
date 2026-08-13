import assert from "node:assert/strict";
import test from "node:test";
import { ensureReviewSessionWords } from "../src/features/games/ensureReviewSessionWords.js";
import {
  clearReviewSession,
  loadReviewSession,
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

function createWord(id, term) {
  return {
    id,
    term,
    definition: `${term} definition`,
    translation: `${term} translation`,
    review: {
      level: 0,
      nextReviewAt: "2000-01-01T00:00:00.000Z",
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
  };
}

test("ensureReviewSessionWords preserves a session that belongs to the current words", () => {
  const storage = createMemoryStorage();
  const words = [createWord("word-a", "apple"), createWord("word-b", "banana")];

  saveReviewSession(
    { totalCount: 2, wordIds: words.map((word) => word.id) },
    storage,
  );
  const before = loadReviewSession(storage);

  ensureReviewSessionWords(words, { storage });

  assert.deepEqual(loadReviewSession(storage), before);
});

test("ensureReviewSessionWords replaces a session from another account", () => {
  const storage = createMemoryStorage();
  const currentWords = [createWord("word-b", "banana"), createWord("word-c", "cat")];

  saveReviewSession({ totalCount: 2, wordIds: ["word-a", "word-old"] }, storage);

  ensureReviewSessionWords(currentWords, { storage });

  const session = loadReviewSession(storage);
  assert.deepEqual(new Set(session.wordIds), new Set(["word-b", "word-c"]));
  assert.equal(session.totalCount, 2);
});

test("ensureReviewSessionWords clears a stale session when the current account has no words", () => {
  const storage = createMemoryStorage();

  saveReviewSession({ totalCount: 1, wordIds: ["word-a"] }, storage);

  ensureReviewSessionWords([], { storage });

  assert.equal(loadReviewSession(storage), null);
  clearReviewSession(storage);
});
