import assert from "node:assert/strict";
import { test } from "node:test";

import { applySyncedRewardMutation } from "../src/features/rewards/rewardExtensionMutations.js";
import {
  defaultRewardState,
  loadRewardState,
  saveRewardState,
} from "../src/features/rewards/rewardsStore.js";

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

test("synced reward mutation uses latest storage state before persisting", () => {
  const storage = createMemoryStorage();
  saveRewardState(
    {
      ...defaultRewardState,
      coins: 125,
    },
    storage,
  );

  const result = applySyncedRewardMutation(
    storage,
    (currentState) => ({
      success: true,
      state: {
        ...currentState,
        coins: currentState.coins - 25,
      },
    }),
    (nextState) => saveRewardState(nextState, storage),
  );

  assert.equal(result.state.coins, 100);
  assert.equal(loadRewardState(storage).coins, 100);
});

test("failed reward mutation does not persist over newer storage", () => {
  const storage = createMemoryStorage();
  saveRewardState(
    {
      ...defaultRewardState,
      coins: 50,
    },
    storage,
  );

  const result = applySyncedRewardMutation(
    storage,
    (currentState) => ({
      success: false,
      state: {
        ...currentState,
        coins: 0,
      },
    }),
    (nextState) => saveRewardState(nextState, storage),
  );

  assert.equal(result.success, false);
  assert.equal(loadRewardState(storage).coins, 50);
});
