import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DAILY_HERO_BONUS,
  REWARDS_STORAGE_KEY,
} from "../src/features/rewards/rewardConstants.js";
import {
  getMissionDefinition,
  selectDailyMissions,
} from "../src/features/rewards/missionDefinitions.js";
import {
  loadRewardState,
  normalizeRewardState,
} from "../src/features/rewards/rewardsStore.js";

function createMemoryStorage(initialEntries = {}) {
  const values = new Map(Object.entries(initialEntries));

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

test("normalizing a new day grants completed unclaimed mission rewards before reset", () => {
  const yesterday = new Date(2026, 9, 22, 21, 0, 0);
  const today = new Date(2026, 9, 23, 8, 0, 0);
  const yesterdayKey = "2026-10-22";
  const todayKey = "2026-10-23";
  const yesterdayMissions = selectDailyMissions(yesterdayKey);
  const unclaimedMission = yesterdayMissions[0];
  const claimedMission = yesterdayMissions[1];
  const unclaimedReward = getMissionDefinition(unclaimedMission.missionId).rewardCoins;

  const rawState = normalizeRewardState(null, yesterday);
  rawState.coins = 100;
  rawState.weeklyStats.coinsEarned = 25;
  rawState.dailyState = {
    ...rawState.dailyState,
    missions: rawState.dailyState.missions.map((mission) => {
      if (mission.missionId === unclaimedMission.missionId) {
        return { ...mission, progress: 1, completed: true, claimed: false };
      }

      if (mission.missionId === claimedMission.missionId) {
        return { ...mission, progress: 1, completed: true, claimed: true };
      }

      return mission;
    }),
  };

  const normalized = normalizeRewardState(rawState, today);

  assert.equal(normalized.dailyState.dateKey, todayKey);
  assert.deepEqual(normalized.dailyState.missions, selectDailyMissions(todayKey));
  assert.equal(normalized.coins, 100 + unclaimedReward);
  assert.equal(normalized.weeklyStats.coinsEarned, 25 + unclaimedReward);
});

test("daily hero bonus is granted when an expired day had every mission complete", () => {
  const yesterday = new Date(2026, 9, 22, 21, 0, 0);
  const today = new Date(2026, 9, 23, 8, 0, 0);
  const rawState = normalizeRewardState(null, yesterday);
  const pendingMissionCoins = rawState.dailyState.missions.reduce(
    (total, mission) => total + getMissionDefinition(mission.missionId).rewardCoins,
    0,
  );

  rawState.dailyState = {
    ...rawState.dailyState,
    missions: rawState.dailyState.missions.map((mission) => ({
      ...mission,
      progress: 99,
      completed: true,
      claimed: false,
    })),
    dailyHeroClaimed: false,
  };

  const normalized = normalizeRewardState(rawState, today);

  assert.equal(normalized.coins, pendingMissionCoins + DAILY_HERO_BONUS);
  assert.equal(
    normalized.leaderboard.weeklyScores.missionsCompleted,
    rawState.dailyState.missions.length + 1,
  );
});

test("loading an expired reward state persists settlement so rewards are not double granted", () => {
  const yesterday = new Date(2026, 9, 22, 21, 0, 0);
  const today = new Date(2026, 9, 23, 8, 0, 0);
  const rawState = normalizeRewardState(null, yesterday);
  const pendingMission = rawState.dailyState.missions[0];
  const pendingReward = getMissionDefinition(pendingMission.missionId).rewardCoins;

  rawState.coins = 7;
  rawState.dailyState = {
    ...rawState.dailyState,
    missions: rawState.dailyState.missions.map((mission) =>
      mission.missionId === pendingMission.missionId
        ? { ...mission, progress: 1, completed: true, claimed: false }
        : mission,
    ),
  };

  const storage = createMemoryStorage({
    [REWARDS_STORAGE_KEY]: JSON.stringify(rawState),
  });

  const firstLoad = loadRewardState(storage, today);
  const secondLoad = loadRewardState(storage, today);

  assert.equal(firstLoad.coins, 7 + pendingReward);
  assert.equal(secondLoad.coins, 7 + pendingReward);
  assert.equal(secondLoad.dailyState.dateKey, "2026-10-23");
});
