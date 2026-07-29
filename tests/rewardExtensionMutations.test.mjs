import assert from "node:assert/strict";
import test from "node:test";

import { REWARDS_STORAGE_KEY } from "../src/features/rewards/rewardConstants.js";
import {
  buyAvatarItem,
  mutateLatestRewardState,
} from "../src/features/rewards/rewardExtensionsEngine.js";
import {
  defaultRewardState,
  getLocalDateKey,
  loadRewardState,
  normalizeRewardState,
  saveRewardState,
} from "../src/features/rewards/rewardsStore.js";

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

function makeRewardState(overrides = {}) {
  return normalizeRewardState({
    ...defaultRewardState,
    dailyState: {
      dateKey: getLocalDateKey(),
      missions: [],
      dailyHeroClaimed: false,
      processedEvents: [],
    },
    ...overrides,
  });
}

test("reward extension mutation reloads latest state before saving", () => {
  const storage = new MemoryStorage();
  const latestState = makeRewardState({
    coins: 220,
    dailyState: {
      dateKey: getLocalDateKey(),
      missions: [],
      dailyHeroClaimed: false,
      processedEvents: ["review-word:abc"],
    },
  });
  saveRewardState(latestState, storage);

  let observedCoins = 0;
  const result = mutateLatestRewardState(storage, (state) => {
    observedCoins = state.coins;
    return buyAvatarItem(state, "smart_glasses");
  });
  const saved = loadRewardState(storage);

  assert.equal(result.success, true);
  assert.equal(observedCoins, 220);
  assert.equal(saved.coins, 120);
  assert.ok(saved.avatar.ownedItemIds.includes("smart_glasses"));
  assert.ok(saved.dailyState.processedEvents.includes("review-word:abc"));
});

test("failed reward extension mutation leaves stored state unchanged", () => {
  const storage = new MemoryStorage();
  const initialState = makeRewardState({ coins: 10 });
  saveRewardState(initialState, storage);

  const before = storage.getItem(REWARDS_STORAGE_KEY);
  const result = mutateLatestRewardState(storage, (state) =>
    buyAvatarItem(state, "diamond_frame"),
  );

  assert.equal(result.success, false);
  assert.equal(storage.getItem(REWARDS_STORAGE_KEY), before);
});
