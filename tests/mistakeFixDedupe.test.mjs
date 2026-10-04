import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";

class MemoryStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.has(key) ? this.#values.get(key) : null;
  }

  setItem(key, value) {
    this.#values.set(key, String(value));
  }

  removeItem(key) {
    this.#values.delete(key);
  }
}

function seedRewardState(storage, { getLocalDateKey, rewardsStorageKey }) {
  storage.setItem(
    rewardsStorageKey,
    JSON.stringify({
      dailyState: {
        dateKey: getLocalDateKey(),
        dailyHeroClaimed: false,
        processedEvents: [],
        missions: [
          {
            missionId: "fix_mistakes",
            progress: 0,
            completed: false,
            claimed: false,
          },
        ],
      },
    }),
  );
}

function getFixMission(state) {
  return state.dailyState.missions.find((mission) => mission.missionId === "fix_mistakes");
}

test("mistake fix rewards dedupe by mistake occurrence, not just word id", async (t) => {
  const vite = await createServer({
    appType: "custom",
    logLevel: "silent",
    server: {
      middlewareMode: true,
    },
  });
  t.after(async () => {
    await vite.close();
  });
  const { ACTION_TYPES, awardLearningAction } = await vite.ssrLoadModule(
    "/src/features/rewards/rewardsEngine.js",
  );
  const { buildMistakeFixDedupeKey } = await vite.ssrLoadModule(
    "/src/features/rewards/mistakeFixDedupe.js",
  );
  const { getLocalDateKey } = await vite.ssrLoadModule(
    "/src/features/rewards/rewardsStore.js",
  );
  const { REWARDS_STORAGE_KEY } = await vite.ssrLoadModule(
    "/src/features/rewards/rewardConstants.js",
  );
  const storage = new MemoryStorage();
  seedRewardState(storage, {
    getLocalDateKey,
    rewardsStorageKey: REWARDS_STORAGE_KEY,
  });
  const firstOccurrence = {
    id: "word-1",
    mistake: {
      isMistake: true,
      lastMistakeAt: "2026-10-04T09:00:00.000Z",
      mistakeCount: 1,
    },
  };
  const secondOccurrence = {
    id: "word-1",
    mistake: {
      isMistake: true,
      lastMistakeAt: "2026-10-04T10:00:00.000Z",
      mistakeCount: 2,
    },
  };

  const first = awardLearningAction(
    ACTION_TYPES.FIX_MISTAKE,
    { dedupeKey: buildMistakeFixDedupeKey("manual", firstOccurrence) },
    { silent: true, storage },
  );
  const duplicate = awardLearningAction(
    ACTION_TYPES.FIX_MISTAKE,
    { dedupeKey: buildMistakeFixDedupeKey("manual", firstOccurrence) },
    { silent: true, storage },
  );
  const second = awardLearningAction(
    ACTION_TYPES.FIX_MISTAKE,
    { dedupeKey: buildMistakeFixDedupeKey("manual", secondOccurrence) },
    { silent: true, storage },
  );

  assert.equal(first.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(second.duplicate, false);
  assert.equal(second.state.coins, 10);
  assert.equal(second.state.allTimeStats.totalMistakesFixed, 2);
  assert.equal(second.state.weeklyStats.mistakesFixed, 2);
  assert.equal(getFixMission(second.state).progress, 2);
  assert.equal(second.state.dailyState.processedEvents.length, 2);
});
