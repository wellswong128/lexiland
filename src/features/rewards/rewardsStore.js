import { REWARDS_STORAGE_KEY } from "./rewardConstants.js";
import { selectDailyMissions } from "./missionDefinitions.js";

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export const getTodayKey = getLocalDateKey;

function getDefaultStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function getYesterdayKey(now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() - 1);

  return getLocalDateKey(date);
}

export function isSameDay(dateKeyA, dateKeyB) {
  return dateKeyA === dateKeyB;
}

export function isYesterday(dateKey, now = new Date()) {
  return dateKey === getYesterdayKey(now);
}

export function getWeekStartDate(now = new Date()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  const weekday = date.getDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  date.setDate(date.getDate() - daysSinceMonday);

  return getLocalDateKey(date);
}

const defaultAllTimeStats = {
  totalWordsAdded: 0,
  totalWordsReviewed: 0,
  totalQuizzesCompleted: 0,
  totalGamesPlayed: 0,
  totalMistakesFixed: 0,
  totalPhotoAdds: 0,
  latestQuizScore: null,
};

const defaultWeeklyStats = {
  weekStartDate: "",
  activeDays: [],
  wordsAdded: 0,
  wordsReviewed: 0,
  quizzesCompleted: 0,
  gamesPlayed: 0,
  mistakesFixed: 0,
  coinsEarned: 0,
  badgesEarned: [],
};

const defaultDailyState = {
  dateKey: "",
  missions: [],
  dailyHeroClaimed: false,
  processedEvents: [],
};

const defaultAvatarState = {
  selectedAvatarId: "lexi_monster_blue",
  selectedFrameId: null,
  selectedBackgroundId: null,
  selectedAccessoryIds: [],
  selectedEffectId: null,
  ownedItemIds: ["lexi_monster_blue"],
};

const defaultTeamState = {
  teamId: null,
  joinedAt: null,
  weekStartDate: "",
  lastChangeWeekStart: null,
  currentWeekTeamPoints: 0,
  lifetimeTeamPoints: 0,
  teamHelperRewardWeek: null,
};

const defaultLeaderboardState = {
  displayName: "",
  anonymousId: "",
  classCode: "",
  optIn: false,
  weeklyScores: {
    wordsReviewed: 0,
    missionsCompleted: 0,
    mistakesFixed: 0,
    activeDays: 0,
    improvementScore: 0,
    teamPoints: 0,
    quizzesCompleted: 0,
    quizScoreTotal: 0,
    quizAccuracy: 0,
  },
};

const defaultMysteryChestsState = {
  availableChestIds: [],
  openedChestHistory: [],
  lastFreeChestDate: null,
};

const defaultSeasonalEventsState = {
  activeEventId: null,
  eventProgress: {},
  claimedMilestoneIds: [],
};

export const defaultRewardState = {
  coins: 0,
  xp: 0,
  level: 1,
  currentStreak: 0,
  longestStreak: 0,
  lastActiveLearningDate: null,
  earnedBadges: [],
  allTimeStats: { ...defaultAllTimeStats },
  weeklyStats: { ...defaultWeeklyStats },
  dailyState: { ...defaultDailyState },
  avatar: { ...defaultAvatarState },
  team: { ...defaultTeamState },
  leaderboard: { ...defaultLeaderboardState },
  mysteryChests: { ...defaultMysteryChestsState },
  seasonalEvents: { ...defaultSeasonalEventsState },
};

function normalizeDailyState(dailyState, todayKey) {
  if (dailyState?.dateKey === todayKey && Array.isArray(dailyState.missions)) {
    return {
      ...defaultDailyState,
      ...dailyState,
      missions: dailyState.missions.map((mission) => ({
        missionId: mission.missionId,
        progress: Math.max(Number(mission.progress) || 0, 0),
        completed: Boolean(mission.completed),
        claimed: Boolean(mission.claimed),
      })),
      processedEvents: Array.isArray(dailyState.processedEvents)
        ? dailyState.processedEvents
        : [],
    };
  }

  return {
    dateKey: todayKey,
    missions: selectDailyMissions(todayKey),
    dailyHeroClaimed: false,
    processedEvents: [],
  };
}

function normalizeWeeklyStats(weeklyStats, weekStartDate) {
  if (weeklyStats?.weekStartDate === weekStartDate) {
    return {
      ...defaultWeeklyStats,
      ...weeklyStats,
      activeDays: Array.isArray(weeklyStats.activeDays) ? weeklyStats.activeDays : [],
      badgesEarned: Array.isArray(weeklyStats.badgesEarned) ? weeklyStats.badgesEarned : [],
    };
  }

  return {
    ...defaultWeeklyStats,
    weekStartDate,
  };
}

export function normalizeRewardState(rawState, now = new Date()) {
  const todayKey = getLocalDateKey(now);
  const weekStartDate = getWeekStartDate(now);

  if (!rawState || typeof rawState !== "object") {
    return {
      ...defaultRewardState,
      dailyState: normalizeDailyState(null, todayKey),
      weeklyStats: normalizeWeeklyStats(null, weekStartDate),
    };
  }

  const normalized = {
    ...defaultRewardState,
    ...rawState,
    earnedBadges: Array.isArray(rawState.earnedBadges) ? rawState.earnedBadges : [],
    allTimeStats: {
      ...defaultAllTimeStats,
      ...(rawState.allTimeStats && typeof rawState.allTimeStats === "object"
        ? rawState.allTimeStats
        : {}),
    },
    weeklyStats: normalizeWeeklyStats(rawState.weeklyStats, weekStartDate),
    dailyState: normalizeDailyState(rawState.dailyState, todayKey),
    avatar: {
      ...defaultAvatarState,
      ...(rawState.avatar && typeof rawState.avatar === "object" ? rawState.avatar : {}),
      ownedItemIds: Array.isArray(rawState.avatar?.ownedItemIds)
        ? rawState.avatar.ownedItemIds
        : defaultAvatarState.ownedItemIds,
      selectedAccessoryIds: Array.isArray(rawState.avatar?.selectedAccessoryIds)
        ? rawState.avatar.selectedAccessoryIds
        : [],
    },
    team: {
      ...defaultTeamState,
      ...(rawState.team && typeof rawState.team === "object" ? rawState.team : {}),
    },
    leaderboard: {
      ...defaultLeaderboardState,
      ...(rawState.leaderboard && typeof rawState.leaderboard === "object"
        ? rawState.leaderboard
        : {}),
      weeklyScores: {
        ...defaultLeaderboardState.weeklyScores,
        ...(rawState.leaderboard?.weeklyScores ?? {}),
      },
    },
    mysteryChests: {
      ...defaultMysteryChestsState,
      ...(rawState.mysteryChests && typeof rawState.mysteryChests === "object"
        ? rawState.mysteryChests
        : {}),
      availableChestIds: Array.isArray(rawState.mysteryChests?.availableChestIds)
        ? rawState.mysteryChests.availableChestIds
        : [],
      openedChestHistory: Array.isArray(rawState.mysteryChests?.openedChestHistory)
        ? rawState.mysteryChests.openedChestHistory
        : [],
    },
    seasonalEvents: {
      ...defaultSeasonalEventsState,
      ...(rawState.seasonalEvents && typeof rawState.seasonalEvents === "object"
        ? rawState.seasonalEvents
        : {}),
      eventProgress:
        rawState.seasonalEvents?.eventProgress &&
        typeof rawState.seasonalEvents.eventProgress === "object"
          ? rawState.seasonalEvents.eventProgress
          : {},
      claimedMilestoneIds: Array.isArray(rawState.seasonalEvents?.claimedMilestoneIds)
        ? rawState.seasonalEvents.claimedMilestoneIds
        : [],
    },
  };

  return normalized;
}

export function loadRewardState(storage = getDefaultStorage(), now = new Date()) {
  if (!storage) {
    return normalizeRewardState(null, now);
  }

  const rawValue = storage.getItem(REWARDS_STORAGE_KEY);

  if (!rawValue) {
    return normalizeRewardState(null, now);
  }

  try {
    return normalizeRewardState(JSON.parse(rawValue), now);
  } catch (error) {
    console.warn("Could not parse stored reward state.", error);
    return normalizeRewardState(null, now);
  }
}

export function saveRewardState(state, storage = getDefaultStorage()) {
  if (!storage) {
    return;
  }

  storage.setItem(REWARDS_STORAGE_KEY, JSON.stringify(state));
}

export function clearRewardState(storage = getDefaultStorage()) {
  if (!storage) {
    return;
  }

  storage.removeItem(REWARDS_STORAGE_KEY);
}

export function hasCompletedLearningToday(state, now = new Date()) {
  return state.lastActiveLearningDate === getLocalDateKey(now);
}
