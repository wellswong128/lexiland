import assert from "node:assert/strict";
import test from "node:test";

import {
  getLocalDateKey,
  getYesterdayKey,
  hasCompletedLearningToday,
  LEGACY_LEARNING_ACTIVITY_KEY,
  loadRewardState,
} from "../src/features/rewards/rewardsStore.js";
import { REWARDS_STORAGE_KEY } from "../src/features/rewards/rewardConstants.js";

class MemoryStorage {
  constructor(entries = {}) {
    this.items = new Map(Object.entries(entries));
  }

  getItem(key) {
    return this.items.has(key) ? this.items.get(key) : null;
  }

  setItem(key, value) {
    this.items.set(key, String(value));
  }

  removeItem(key) {
    this.items.delete(key);
  }
}

function storedJson(value) {
  return JSON.stringify(value);
}

test("loadRewardState migrates legacy learning-activity streaks", () => {
  const storage = new MemoryStorage({
    [LEGACY_LEARNING_ACTIVITY_KEY]: storedJson({
      currentStreak: 5,
      lastActiveDate: "2026-09-03",
    }),
  });

  const state = loadRewardState(storage, new Date("2026-09-04T12:00:00"));

  assert.equal(state.currentStreak, 5);
  assert.equal(state.longestStreak, 5);
  assert.equal(state.lastActiveLearningDate, "2026-09-03");
});

test("legacy streak from yesterday remains ready for continuation", () => {
  const storage = new MemoryStorage({
    [LEGACY_LEARNING_ACTIVITY_KEY]: storedJson({
      currentStreak: 5,
      lastActiveDate: getYesterdayKey(),
    }),
  });

  const state = loadRewardState(storage);

  assert.equal(state.currentStreak, 5);
  assert.equal(state.longestStreak, 5);
  assert.equal(state.lastActiveLearningDate, getYesterdayKey());
  assert.equal(hasCompletedLearningToday(state), false);
});

test("already-created reset reward state can recover from yesterday legacy streak", () => {
  const storage = new MemoryStorage({
    [LEGACY_LEARNING_ACTIVITY_KEY]: storedJson({
      currentStreak: 5,
      lastActiveDate: getYesterdayKey(),
    }),
    [REWARDS_STORAGE_KEY]: storedJson({
      currentStreak: 1,
      longestStreak: 1,
      lastActiveLearningDate: getLocalDateKey(),
    }),
  });

  const state = loadRewardState(storage);

  assert.equal(state.currentStreak, 6);
  assert.equal(state.longestStreak, 6);
  assert.equal(state.lastActiveLearningDate, getLocalDateKey());
});

test("legacy data never lowers an established reward streak", () => {
  const storage = new MemoryStorage({
    [LEGACY_LEARNING_ACTIVITY_KEY]: storedJson({
      currentStreak: 3,
      lastActiveDate: getLocalDateKey(),
    }),
    [REWARDS_STORAGE_KEY]: storedJson({
      currentStreak: 7,
      longestStreak: 9,
      lastActiveLearningDate: getLocalDateKey(),
    }),
  });

  const state = loadRewardState(storage);

  assert.equal(state.currentStreak, 7);
  assert.equal(state.longestStreak, 9);
});
