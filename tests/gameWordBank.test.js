import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGameWordBank,
  GAME_FALLBACK_WORDS,
  getPlayableQuestionEntries,
  pickRandomEntry,
  shouldUseGamePlan,
} from "../src/features/games/gameWordBank.js";
import {
  clearReviewSession,
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

test("active review sessions without saved words fall back to playable entries", () => {
  const storage = createMemoryStorage();
  global.window = { localStorage: storage };
  saveReviewSession({ totalCount: 1, wordIds: ["missing-word"] }, storage);

  const bank = buildGameWordBank([], { minWords: 4 });

  assert.equal(bank.usingFallback, true);
  assert.equal(bank.questionEntries.length, 0);
  assert.equal(bank.entries.length, GAME_FALLBACK_WORDS.length);
  assert.equal(shouldUseGamePlan(bank), false);
  assert.equal(getPlayableQuestionEntries(bank, bank.entries), bank.entries);
  assert.ok(pickRandomEntry(bank.entries, bank));

  clearReviewSession(storage);
  delete global.window;
});
