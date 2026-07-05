import { getDueWords } from "../review/reviewHelpers.js";
import { BADGE_DEFINITIONS } from "./badgeDefinitions.js";
import { getMissionDefinition } from "./missionDefinitions.js";
import {
  ACTION_TYPES,
  COIN_REWARDS,
  DAILY_HERO_BONUS,
  MEANINGFUL_ACTIONS,
} from "./rewardConstants.js";
import {
  getLocalDateKey,
  getYesterdayKey,
  hasCompletedLearningToday,
  loadRewardState,
  saveRewardState,
} from "./rewardsStore.js";
import {
  applyDailyHeroExtensions,
  applyMissionClaimExtensions,
  applyRewardExtensions,
  syncRewardExtensions,
} from "./rewardExtensionsEngine.js";
import { notifyRewardUpdate, showRewardToast } from "./rewardToasts.js";

function getDefaultStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function buildEventKey(actionType, payload = {}) {
  if (payload.dedupeKey) {
    return `${actionType}:${payload.dedupeKey}`;
  }

  if (payload.wordId) {
    return `${actionType}:${payload.wordId}`;
  }

  return `${actionType}:${Date.now()}`;
}

function wasEventProcessed(state, eventKey) {
  return state.dailyState.processedEvents.includes(eventKey);
}

function markEventProcessed(state, eventKey) {
  return {
    ...state,
    dailyState: {
      ...state.dailyState,
      processedEvents: [...state.dailyState.processedEvents, eventKey],
    },
  };
}

function addCoins(state, amount) {
  if (amount <= 0) {
    return state;
  }

  return {
    ...state,
    coins: state.coins + amount,
    weeklyStats: {
      ...state.weeklyStats,
      coinsEarned: state.weeklyStats.coinsEarned + amount,
    },
  };
}

function trackActiveDay(state, todayKey) {
  const activeDays = state.weeklyStats.activeDays.includes(todayKey)
    ? state.weeklyStats.activeDays
    : [...state.weeklyStats.activeDays, todayKey];

  return {
    ...state,
    weeklyStats: {
      ...state.weeklyStats,
      activeDays,
    },
  };
}

function updateStreak(state, todayKey) {
  if (hasCompletedLearningToday(state)) {
    return state;
  }

  const yesterdayKey = getYesterdayKey();
  let nextStreak = 1;

  if (state.lastActiveLearningDate === yesterdayKey) {
    nextStreak = Math.max(state.currentStreak, 0) + 1;
  }

  return {
    ...state,
    currentStreak: nextStreak,
    longestStreak: Math.max(state.longestStreak, nextStreak),
    lastActiveLearningDate: todayKey,
  };
}

function incrementMissionProgress(state, actionType, amount = 1) {
  const missions = state.dailyState.missions.map((mission) => {
    const definition = getMissionDefinition(mission.missionId);

    if (!definition || definition.actionType !== actionType) {
      return mission;
    }

    const progress = Math.min(mission.progress + amount, definition.target);
    const completed = progress >= definition.target;

    return {
      ...mission,
      progress,
      completed,
    };
  });

  return {
    ...state,
    dailyState: {
      ...state.dailyState,
      missions,
    },
  };
}

function updateAllTimeStats(state, actionType, payload = {}) {
  const allTimeStats = { ...state.allTimeStats };

  switch (actionType) {
    case ACTION_TYPES.ADD_WORD:
      allTimeStats.totalWordsAdded += 1;
      break;
    case ACTION_TYPES.PHOTO_ADD:
      allTimeStats.totalPhotoAdds += 1;
      break;
    case ACTION_TYPES.REVIEW_WORD:
      allTimeStats.totalWordsReviewed += 1;
      break;
    case ACTION_TYPES.COMPLETE_QUIZ:
      allTimeStats.totalQuizzesCompleted += 1;
      if (typeof payload.scorePercent === "number") {
        allTimeStats.latestQuizScore = payload.scorePercent;
      }
      break;
    case ACTION_TYPES.PLAY_GAME:
      allTimeStats.totalGamesPlayed += 1;
      break;
    case ACTION_TYPES.FIX_MISTAKE:
      allTimeStats.totalMistakesFixed += 1;
      break;
    default:
      break;
  }

  return {
    ...state,
    allTimeStats,
  };
}

function updateWeeklyStats(state, actionType) {
  const weeklyStats = { ...state.weeklyStats };

  switch (actionType) {
    case ACTION_TYPES.ADD_WORD:
      weeklyStats.wordsAdded += 1;
      break;
    case ACTION_TYPES.REVIEW_WORD:
      weeklyStats.wordsReviewed += 1;
      break;
    case ACTION_TYPES.COMPLETE_QUIZ:
      weeklyStats.quizzesCompleted += 1;
      break;
    case ACTION_TYPES.PLAY_GAME:
      weeklyStats.gamesPlayed += 1;
      break;
    case ACTION_TYPES.FIX_MISTAKE:
      weeklyStats.mistakesFixed += 1;
      break;
    default:
      break;
  }

  return {
    ...state,
    weeklyStats,
  };
}

function buildBadgeContext(state, words = []) {
  return {
    ...state,
    dueWords: getDueWords(words).length,
  };
}

function awardNewBadges(state, words = [], t) {
  const context = buildBadgeContext(state, words);
  const newlyEarned = [];

  BADGE_DEFINITIONS.forEach((badge) => {
    if (state.earnedBadges.includes(badge.id)) {
      return;
    }

    if (!badge.check(context)) {
      return;
    }

    newlyEarned.push(badge.id);
  });

  if (newlyEarned.length === 0) {
    return state;
  }

  newlyEarned.forEach((badgeId) => {
    const message = t
      ? t("rewards.toast.badgeEarned", { badge: t(`rewards.badges.${badgeId}.name`) })
      : `Congratulations! You earned the ${badgeId} badge!`;
    showRewardToast(message, "badge");
  });

  return {
    ...state,
    earnedBadges: [...state.earnedBadges, ...newlyEarned],
    weeklyStats: {
      ...state.weeklyStats,
      badgesEarned: [...new Set([...state.weeklyStats.badgesEarned, ...newlyEarned])],
    },
  };
}

function getToastMessage(actionType, coinsEarned, t) {
  if (!t) {
    return coinsEarned > 0 ? `+${coinsEarned} coins!` : "";
  }

  const toastKeys = {
    [ACTION_TYPES.ADD_WORD]: "rewards.toast.wordAdded",
    [ACTION_TYPES.REVIEW_WORD]: "rewards.toast.wordReviewed",
    [ACTION_TYPES.CORRECT_QUIZ_ANSWER]: "rewards.toast.quizCorrect",
    [ACTION_TYPES.COMPLETE_QUIZ]: "rewards.toast.quizCompleted",
    [ACTION_TYPES.PLAY_GAME]: "rewards.toast.gamePlayed",
    [ACTION_TYPES.FIX_MISTAKE]: "rewards.toast.mistakeFixed",
  };

  const key = toastKeys[actionType];

  if (!key || coinsEarned <= 0) {
    return "";
  }

  return t(key, { coins: coinsEarned });
}

function notifyMissionCompleteIfNeeded(previousState, nextState, t) {
  nextState.dailyState.missions.forEach((mission) => {
    const previousMission = previousState.dailyState.missions.find(
      (item) => item.missionId === mission.missionId,
    );

    if (!previousMission?.completed && mission.completed && !mission.claimed) {
      const message = t
        ? t("rewards.toast.missionComplete")
        : "Daily mission complete! Claim your reward.";
      showRewardToast(message, "mission");
    }
  });
}

export function awardLearningAction(actionType, payload = {}, options = {}) {
  const storage = options.storage ?? getDefaultStorage();
  const t = options.t;
  const words = options.words ?? [];
  const silent = Boolean(options.silent);
  let state = syncRewardExtensions(loadRewardState(storage));
  const todayKey = getLocalDateKey();
  const eventKey = buildEventKey(actionType, payload);

  if (wasEventProcessed(state, eventKey)) {
    return { state, coinsEarned: 0, duplicate: true };
  }

  const previousState = state;
  state = markEventProcessed(state, eventKey);

  const coinAmount = COIN_REWARDS[actionType] ?? 0;

  if (coinAmount > 0) {
    state = addCoins(state, coinAmount);
  }

  state = updateAllTimeStats(state, actionType, payload);
  state = updateWeeklyStats(state, actionType);
  state = incrementMissionProgress(state, actionType, payload.amount ?? 1);

  if (MEANINGFUL_ACTIONS.has(actionType)) {
    const streakWasUpdated = !hasCompletedLearningToday(state);
    state = updateStreak(state, todayKey);
    state = trackActiveDay(state, todayKey);
    state = applyRewardExtensions(state, actionType, payload, {
      streakWasUpdated,
    });
  } else {
    state = applyRewardExtensions(state, actionType, payload);
  }

  state = awardNewBadges(state, words, t);
  saveRewardState(state, storage);
  notifyRewardUpdate();

  if (!silent) {
    const toastMessage = getToastMessage(actionType, coinAmount, t);

    if (toastMessage) {
      showRewardToast(toastMessage, "coin");
    }

    notifyMissionCompleteIfNeeded(previousState, state, t);
  }

  return { state, coinsEarned: coinAmount, duplicate: false };
}

export function claimMissionReward(missionId, options = {}) {
  const storage = options.storage ?? getDefaultStorage();
  const t = options.t;
  let state = syncRewardExtensions(loadRewardState(storage));
  const missionIndex = state.dailyState.missions.findIndex(
    (mission) => mission.missionId === missionId,
  );

  if (missionIndex < 0) {
    return { state, coinsEarned: 0 };
  }

  const mission = state.dailyState.missions[missionIndex];
  const definition = getMissionDefinition(missionId);

  if (!definition || !mission.completed || mission.claimed) {
    return { state, coinsEarned: 0 };
  }

  const missions = [...state.dailyState.missions];
  missions[missionIndex] = {
    ...mission,
    claimed: true,
  };

  state = {
    ...state,
    dailyState: {
      ...state.dailyState,
      missions,
    },
  };

  state = addCoins(state, definition.rewardCoins);
  state = applyMissionClaimExtensions(state);
  saveRewardState(state, storage);
  notifyRewardUpdate();

  const message = t
    ? t("rewards.toast.missionClaimed", { coins: definition.rewardCoins })
    : `+${definition.rewardCoins} coins! Mission reward claimed.`;

  showRewardToast(message, "coin");

  return { state, coinsEarned: definition.rewardCoins };
}

export function claimDailyHeroBonus(options = {}) {
  const storage = options.storage ?? getDefaultStorage();
  const t = options.t;
  let state = syncRewardExtensions(loadRewardState(storage));

  const allMissionsComplete = state.dailyState.missions.every(
    (mission) => mission.completed && mission.claimed,
  );

  if (!allMissionsComplete || state.dailyState.dailyHeroClaimed) {
    return { state, coinsEarned: 0 };
  }

  state = {
    ...state,
    dailyState: {
      ...state.dailyState,
      dailyHeroClaimed: true,
    },
  };
  state = addCoins(state, DAILY_HERO_BONUS);
  state = applyDailyHeroExtensions(state);
  saveRewardState(state, storage);
  notifyRewardUpdate();

  const message = t
    ? t("rewards.toast.dailyHeroBonus", { coins: DAILY_HERO_BONUS })
    : `Daily Hero Bonus earned! +${DAILY_HERO_BONUS} coins.`;

  showRewardToast(message, "hero");

  return { state, coinsEarned: DAILY_HERO_BONUS };
}

export function checkAndAwardBadges(words = [], options = {}) {
  const storage = options.storage ?? getDefaultStorage();
  const t = options.t;
  let state = syncRewardExtensions(loadRewardState(storage));
  const previousBadgeCount = state.earnedBadges.length;

  state = awardNewBadges(state, words, t);

  if (state.earnedBadges.length !== previousBadgeCount) {
    saveRewardState(state, storage);
    notifyRewardUpdate();
  }

  return state;
}

export function getMissionViews(state) {
  return state.dailyState.missions.map((mission) => {
    const definition = getMissionDefinition(mission.missionId);

    return {
      id: mission.missionId,
      progress: mission.progress,
      target: definition?.target ?? 0,
      rewardCoins: definition?.rewardCoins ?? 0,
      completed: mission.completed,
      claimed: mission.claimed,
      to: definition?.to ?? "/",
      emoji: definition?.emoji ?? "✨",
      actionType: definition?.actionType ?? "",
    };
  });
}

export function getBadgeViews(state) {
  return BADGE_DEFINITIONS.map((badge) => ({
    id: badge.id,
    icon: badge.icon,
    earned: state.earnedBadges.includes(badge.id),
  }));
}

export function getWeeklyRewardSummary(state, words = []) {
  const weekly = state.weeklyStats;
  const activeDays = weekly.activeDays.length;
  const mistakeCount = words.filter((word) => word.mistake?.isMistake).length;
  const latestQuizScore = state.allTimeStats.latestQuizScore;

  let suggestedFocus = "keepGoing";

  if (weekly.mistakesFixed < 3 && mistakeCount > 0) {
    suggestedFocus = "fixMistakes";
  } else if (weekly.wordsReviewed < 15) {
    suggestedFocus = "reviewDaily";
  } else if (activeDays < 5) {
    suggestedFocus = "activeDays";
  } else if (typeof latestQuizScore === "number" && latestQuizScore < 80) {
    suggestedFocus = "quizAccuracy";
  }

  return {
    activeDays,
    currentStreak: state.currentStreak,
    longestStreak: state.longestStreak,
    wordsAdded: weekly.wordsAdded,
    wordsReviewed: weekly.wordsReviewed,
    quizzesCompleted: weekly.quizzesCompleted,
    gamesPlayed: weekly.gamesPlayed,
    mistakesFixed: weekly.mistakesFixed,
    coinsEarned: weekly.coinsEarned,
    badgesEarned: weekly.badgesEarned,
    suggestedFocus,
    weekStartDate: weekly.weekStartDate,
  };
}

export function getDailyMissionSummary(state) {
  const missions = state.dailyState.missions;
  const completedCount = missions.filter((mission) => mission.completed).length;
  const allMissionsClaimed = missions.every(
    (mission) => mission.completed && mission.claimed,
  );
  const dailyHeroClaimable =
    missions.every((mission) => mission.completed && mission.claimed) &&
    !state.dailyState.dailyHeroClaimed;

  return {
    completedCount,
    totalCount: missions.length,
    allMissionsClaimed,
    dailyHeroClaimable,
    dailyHeroClaimed: state.dailyState.dailyHeroClaimed,
    streakSafeToday: hasCompletedLearningToday(state),
  };
}

export { ACTION_TYPES } from "./rewardConstants.js";
