import assert from "node:assert/strict";
import test from "node:test";

import { buildReminderSnapshot } from "../src/features/reminders/buildReminderSnapshot.js";
import { normalizeRewardState, saveRewardState } from "../src/features/rewards/rewardsStore.js";
import {
  getLocalDateKey,
  saveLearningActivity,
} from "../src/lib/learningActivity.js";
import {
  clearActiveStorageUserId,
  setActiveStorageUserId,
} from "../src/lib/userScopedStorage.js";

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test("reminder snapshots only read reward and activity state for the requested user", () => {
  const storage = createMemoryStorage();
  const todayKey = getLocalDateKey();

  const userARewardState = normalizeRewardState(null);
  userARewardState.currentStreak = 14;
  userARewardState.lastActiveLearningDate = todayKey;
  saveRewardState(userARewardState, storage, "user-a");
  saveLearningActivity(
    {
      currentStreak: 14,
      lastActiveDate: todayKey,
      lastActivity: { kind: "game", recordedAt: new Date().toISOString() },
      visitedPaths: ["/games/spelling-ninja"],
      dailyStats: {
        [todayKey]: {
          gamesPlayed: 1,
          mistakesCleared: 3,
        },
      },
    },
    storage,
    "user-a",
  );

  const userASnapshot = buildReminderSnapshot([], "en", { storage, userId: "user-a" });
  assert.equal(userASnapshot.streak, 14);
  assert.equal(userASnapshot.hasCompletedLearningToday, true);
  assert.equal(userASnapshot.dailyTasksCompleted, 2);

  const userBSnapshot = buildReminderSnapshot([], "en", { storage, userId: "user-b" });
  assert.equal(userBSnapshot.streak, 0);
  assert.equal(userBSnapshot.hasCompletedLearningToday, false);
  assert.equal(userBSnapshot.dailyTasksCompleted, 0);
});

test("default reward storage follows the active authenticated user scope", () => {
  const storage = createMemoryStorage();
  const userARewardState = normalizeRewardState(null);
  userARewardState.currentStreak = 5;

  setActiveStorageUserId("user-a", storage);
  saveRewardState(userARewardState, storage);

  setActiveStorageUserId("user-b", storage);
  assert.equal(buildReminderSnapshot([], "en", { storage }).streak, 0);

  setActiveStorageUserId("user-a", storage);
  assert.equal(buildReminderSnapshot([], "en", { storage }).streak, 5);

  clearActiveStorageUserId(storage);
  assert.equal(buildReminderSnapshot([], "en", { storage }).streak, 0);
});
