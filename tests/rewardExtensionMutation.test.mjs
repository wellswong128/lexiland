import assert from "node:assert/strict";
import test from "node:test";

import {
  buyAvatarItem,
  updateSyncedRewardState,
} from "../src/features/rewards/rewardExtensionsEngine.js";
import { loadRewardState, saveRewardState } from "../src/features/rewards/rewardsStore.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

test("reward extension mutations preserve newer learning progress in storage", () => {
  const storage = new MemoryStorage();
  const initialState = {
    ...loadRewardState(storage),
    coins: 200,
  };

  saveRewardState(initialState, storage);
  const staleRewardCenterSnapshot = loadRewardState(storage);

  const learningProgressState = {
    ...loadRewardState(storage),
    coins: 202,
    allTimeStats: {
      ...initialState.allTimeStats,
      totalWordsReviewed: 1,
    },
    weeklyStats: {
      ...initialState.weeklyStats,
      wordsReviewed: 1,
    },
  };

  saveRewardState(learningProgressState, storage);

  const afterLearning = loadRewardState(storage);
  assert.equal(afterLearning.allTimeStats.totalWordsReviewed, 1);
  assert.equal(afterLearning.weeklyStats.wordsReviewed, 1);
  assert.equal(afterLearning.coins, 202);

  const result = updateSyncedRewardState(
    (latestState) => {
      assert.equal(latestState.allTimeStats.totalWordsReviewed, 1);
      assert.equal(staleRewardCenterSnapshot.allTimeStats.totalWordsReviewed, 0);

      return buyAvatarItem(latestState, "smart_glasses");
    },
    { storage },
  );

  assert.equal(result.success, true);

  const finalState = loadRewardState(storage);
  assert.equal(finalState.allTimeStats.totalWordsReviewed, 1);
  assert.equal(finalState.weeklyStats.wordsReviewed, 1);
  assert.equal(finalState.coins, 102);
  assert.ok(finalState.avatar.ownedItemIds.includes("smart_glasses"));
});
