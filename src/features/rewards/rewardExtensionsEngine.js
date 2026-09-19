import { ACTION_TYPES } from "./rewardConstants.js";
import {
  AVATAR_SHOP_CATEGORIES,
  DUPLICATE_COSMETIC_COINS,
  getActiveSeasonalEvent,
  getChestDefinition,
  getCosmeticPool,
  getShopItem,
  STREAK_CHEST_MILESTONES,
  TEAM_HELPER_COIN_REWARD,
  TEAM_HELPER_POINT_THRESHOLD,
  TEAM_POINT_RULES,
  TEAM_WEEKLY_GOAL,
  TEAMS,
} from "./rewardExtensionDefinitions.js";
import {
  getLocalDateKey,
  getWeekStartDate,
  hasCompletedLearningToday,
  loadRewardState,
  saveRewardState,
} from "./rewardsStore.js";
import { showRewardToast } from "./rewardToasts.js";

function createAnonymousId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeightedReward(rewardTable) {
  const totalWeight = rewardTable.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const entry of rewardTable) {
    roll -= entry.weight;

    if (roll <= 0) {
      return entry;
    }
  }

  return rewardTable[0];
}

function addCoinsToState(state, amount) {
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

function grantOwnedItem(state, itemId) {
  const ownedItemIds = state.avatar.ownedItemIds.includes(itemId)
    ? state.avatar.ownedItemIds
    : [...state.avatar.ownedItemIds, itemId];

  return {
    ...state,
    avatar: {
      ...state.avatar,
      ownedItemIds,
    },
  };
}

function grantBadge(state, badgeId) {
  if (state.earnedBadges.includes(badgeId)) {
    return state;
  }

  return {
    ...state,
    earnedBadges: [...state.earnedBadges, badgeId],
    weeklyStats: {
      ...state.weeklyStats,
      badgesEarned: [...new Set([...state.weeklyStats.badgesEarned, badgeId])],
    },
  };
}

function addAvailableChest(state, chestId) {
  if (state.mysteryChests.availableChestIds.includes(chestId)) {
    return state;
  }

  return {
    ...state,
    mysteryChests: {
      ...state.mysteryChests,
      availableChestIds: [...state.mysteryChests.availableChestIds, chestId],
    },
  };
}

function removeAvailableChest(state, chestId) {
  return {
    ...state,
    mysteryChests: {
      ...state.mysteryChests,
      availableChestIds: state.mysteryChests.availableChestIds.filter((id) => id !== chestId),
    },
  };
}

function updateImprovementScore(scores) {
  const missionsCompleted = scores.missionsCompleted ?? 0;

  return scores.mistakesFixed * 3 + scores.wordsReviewed + missionsCompleted * 5;
}

function updateLeaderboardScores(state, updates = {}) {
  const weeklyScores = {
    ...state.leaderboard.weeklyScores,
    ...updates,
  };

  weeklyScores.improvementScore = updateImprovementScore(weeklyScores);

  if (weeklyScores.quizzesCompleted >= 2 && weeklyScores.quizScoreTotal > 0) {
    weeklyScores.quizAccuracy = Math.round(
      weeklyScores.quizScoreTotal / weeklyScores.quizzesCompleted,
    );
  } else {
    weeklyScores.quizAccuracy = 0;
  }

  weeklyScores.activeDays = state.weeklyStats.activeDays.length;

  return {
    ...state,
    leaderboard: {
      ...state.leaderboard,
      weeklyScores,
    },
  };
}

function addTeamPoints(state, points, weekStartDate) {
  if (!state.team.teamId || points <= 0) {
    return state;
  }

  const team = {
    ...state.team,
    weekStartDate,
    currentWeekTeamPoints: state.team.currentWeekTeamPoints + points,
    lifetimeTeamPoints: state.team.lifetimeTeamPoints + points,
  };

  return updateLeaderboardScores(
    {
      ...state,
      team,
    },
    {
      teamPoints: team.currentWeekTeamPoints,
    },
  );
}

function syncSeasonalEventState(state, now = new Date()) {
  const activeEvent = getActiveSeasonalEvent(now);

  return {
    ...state,
    seasonalEvents: {
      ...state.seasonalEvents,
      activeEventId: activeEvent?.id ?? null,
    },
  };
}

function incrementEventProgress(state, progressKey, amount = 1) {
  const activeEventId = state.seasonalEvents.activeEventId;

  if (!activeEventId) {
    return state;
  }

  const activeEvent = getActiveSeasonalEvent();

  if (!activeEvent || activeEvent.progressKey !== progressKey) {
    return state;
  }

  const currentProgress = state.seasonalEvents.eventProgress[activeEventId] ?? 0;

  return {
    ...state,
    seasonalEvents: {
      ...state.seasonalEvents,
      eventProgress: {
        ...state.seasonalEvents.eventProgress,
        [activeEventId]: currentProgress + amount,
      },
    },
  };
}

export function syncRewardExtensions(state, now = new Date()) {
  let nextState = syncSeasonalEventState(state, now);
  const weekStartDate = getWeekStartDate(now);

  if (nextState.team.weekStartDate && nextState.team.weekStartDate !== weekStartDate) {
    if (
      nextState.team.currentWeekTeamPoints >= TEAM_HELPER_POINT_THRESHOLD &&
      nextState.team.teamHelperRewardWeek !== nextState.team.weekStartDate
    ) {
      nextState = addCoinsToState(nextState, TEAM_HELPER_COIN_REWARD);
      nextState = grantBadge(nextState, "team_helper");
      nextState = {
        ...nextState,
        team: {
          ...nextState.team,
          teamHelperRewardWeek: nextState.team.weekStartDate,
        },
      };
      showRewardToast(`Team Helper reward! +${TEAM_HELPER_COIN_REWARD} coins.`, "hero");
    }

    nextState = {
      ...nextState,
      team: {
        ...nextState.team,
        weekStartDate,
        currentWeekTeamPoints: 0,
      },
      leaderboard: {
        ...nextState.leaderboard,
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
      },
    };
  } else if (!nextState.team.weekStartDate) {
    nextState = {
      ...nextState,
      team: {
        ...nextState.team,
        weekStartDate,
      },
    };
  }

  nextState = syncAvailableChests(nextState, now);

  if (!nextState.leaderboard.anonymousId) {
    nextState = {
      ...nextState,
      leaderboard: {
        ...nextState.leaderboard,
        anonymousId: createAnonymousId(),
      },
    };
  }

  return nextState;
}

export function syncAvailableChests(state, now = new Date()) {
  const todayKey = getLocalDateKey(now);
  let availableChestIds = [...state.mysteryChests.availableChestIds];
  const openedIds = new Set(
    state.mysteryChests.openedChestHistory.map((entry) => entry.chestId),
  );

  const allMissionsComplete = state.dailyState.missions.every((mission) => mission.completed);
  const dailyAlreadyOpened = state.mysteryChests.lastFreeChestDate === todayKey;

  if (
    hasCompletedLearningToday(state, now) &&
    !dailyAlreadyOpened &&
    !availableChestIds.includes("daily_chest")
  ) {
    availableChestIds.push("daily_chest");
  }

  if (allMissionsComplete && !availableChestIds.includes("mission_chest")) {
    const missionChestOpenedToday = state.mysteryChests.openedChestHistory.some(
      (entry) => entry.chestId === "mission_chest" && entry.date === todayKey,
    );

    if (!missionChestOpenedToday) {
      availableChestIds.push("mission_chest");
    }
  }

  STREAK_CHEST_MILESTONES.forEach((milestone) => {
    const chestId = `streak_chest_${milestone}`;

    if (
      state.currentStreak >= milestone &&
      !openedIds.has(chestId) &&
      !availableChestIds.includes(chestId)
    ) {
      availableChestIds.push(chestId);
    }
  });

  return {
    ...state,
    mysteryChests: {
      ...state.mysteryChests,
      availableChestIds: [...new Set(availableChestIds)],
    },
  };
}

function mapActionToTeamKey(actionType) {
  switch (actionType) {
    case ACTION_TYPES.ADD_WORD:
      return "add_word";
    case ACTION_TYPES.REVIEW_WORD:
      return "review_word";
    case ACTION_TYPES.COMPLETE_QUIZ:
      return "complete_quiz";
    case ACTION_TYPES.PLAY_GAME:
      return "play_game";
    case ACTION_TYPES.FIX_MISTAKE:
      return "fix_mistake";
    default:
      return null;
  }
}

function mapActionToEventKey(actionType) {
  switch (actionType) {
    case ACTION_TYPES.ADD_WORD:
      return "wordsAdded";
    case ACTION_TYPES.REVIEW_WORD:
      return "wordsReviewed";
    case ACTION_TYPES.COMPLETE_QUIZ:
      return "quizzesCompleted";
    case ACTION_TYPES.FIX_MISTAKE:
      return "mistakesFixed";
    default:
      return null;
  }
}

export function applyRewardExtensions(state, actionType, payload = {}, options = {}) {
  let nextState = syncRewardExtensions(state, options.now);
  const weekStartDate = getWeekStartDate(options.now);
  const streakWasUpdated = Boolean(options.streakWasUpdated);

  const teamKey = mapActionToTeamKey(actionType);

  if (teamKey) {
    nextState = addTeamPoints(nextState, TEAM_POINT_RULES[teamKey] ?? 0, weekStartDate);
  }

  if (streakWasUpdated) {
    nextState = addTeamPoints(nextState, TEAM_POINT_RULES.streak_safe ?? 0, weekStartDate);
  }

  const eventKey = mapActionToEventKey(actionType);

  if (eventKey) {
    nextState = incrementEventProgress(nextState, eventKey, payload.amount ?? 1);
  }

  const leaderboardUpdates = {};

  if (actionType === ACTION_TYPES.REVIEW_WORD) {
    leaderboardUpdates.wordsReviewed = nextState.leaderboard.weeklyScores.wordsReviewed + 1;
  }

  if (actionType === ACTION_TYPES.FIX_MISTAKE) {
    leaderboardUpdates.mistakesFixed = nextState.leaderboard.weeklyScores.mistakesFixed + 1;
  }

  if (actionType === ACTION_TYPES.COMPLETE_QUIZ) {
    leaderboardUpdates.quizzesCompleted =
      nextState.leaderboard.weeklyScores.quizzesCompleted + 1;

    if (typeof payload.scorePercent === "number") {
      leaderboardUpdates.quizScoreTotal =
        nextState.leaderboard.weeklyScores.quizScoreTotal + payload.scorePercent;
    }
  }

  if (Object.keys(leaderboardUpdates).length > 0) {
    nextState = updateLeaderboardScores(nextState, leaderboardUpdates);
  }

  return syncAvailableChests(nextState, options.now);
}

export function applyDailyHeroExtensions(state, options = {}) {
  const weekStartDate = getWeekStartDate(options.now ?? new Date());
  let nextState = syncRewardExtensions(state, options.now);

  nextState = addTeamPoints(nextState, TEAM_POINT_RULES.daily_hero_bonus, weekStartDate);
  nextState = updateLeaderboardScores(nextState, {
    missionsCompleted: nextState.leaderboard.weeklyScores.missionsCompleted + 1,
  });

  return syncAvailableChests(nextState, options.now);
}

export function applyMissionClaimExtensions(state) {
  return updateLeaderboardScores(
    syncAvailableChests(state),
    {
      missionsCompleted: state.leaderboard.weeklyScores.missionsCompleted + 1,
    },
  );
}

export function buyAvatarItem(state, itemId, options = {}) {
  const t = options.t;
  const item = getShopItem(itemId);

  if (!item) {
    return { state, success: false, reason: "not_found" };
  }

  if (item.eventOnly && !state.avatar.ownedItemIds.includes(itemId)) {
    return { state, success: false, reason: "event_only" };
  }

  if (state.avatar.ownedItemIds.includes(itemId)) {
    return { state, success: false, reason: "already_owned" };
  }

  if (state.coins < item.price) {
    const message = t
      ? t("rewards.center.shop.notEnoughCoins")
      : "Not enough coins yet. Complete missions to earn more!";
    showRewardToast(message, "coin");
    return { state, success: false, reason: "insufficient_coins" };
  }

  const nextState = {
    ...state,
    coins: state.coins - item.price,
    avatar: {
      ...state.avatar,
      ownedItemIds: [...state.avatar.ownedItemIds, itemId],
    },
  };

  const message = t
    ? t("rewards.center.shop.bought", { item: t(`rewards.center.shop.items.${itemId}.name`) })
    : `Bought ${itemId}!`;

  showRewardToast(message, "coin");

  return { state: nextState, success: true };
}

export function equipAvatarItem(state, itemId, options = {}) {
  const t = options.t;
  const item = getShopItem(itemId);

  if (!item || !state.avatar.ownedItemIds.includes(itemId)) {
    return { state, success: false };
  }

  const avatar = { ...state.avatar };

  switch (item.category) {
    case AVATAR_SHOP_CATEGORIES.AVATAR:
      avatar.selectedAvatarId = itemId;
      break;
    case AVATAR_SHOP_CATEGORIES.FRAME:
      avatar.selectedFrameId = itemId;
      break;
    case AVATAR_SHOP_CATEGORIES.BACKGROUND:
      avatar.selectedBackgroundId = itemId;
      break;
    case AVATAR_SHOP_CATEGORIES.ACCESSORY:
      avatar.selectedAccessoryIds = avatar.selectedAccessoryIds.includes(itemId)
        ? avatar.selectedAccessoryIds.filter((id) => id !== itemId)
        : [...avatar.selectedAccessoryIds, itemId];
      break;
    case AVATAR_SHOP_CATEGORIES.EFFECT:
      avatar.selectedEffectId = avatar.selectedEffectId === itemId ? null : itemId;
      break;
    default:
      return { state, success: false };
  }

  const message = t
    ? t("rewards.center.shop.equipped", { item: t(`rewards.center.shop.items.${itemId}.name`) })
    : `Equipped ${itemId}!`;

  showRewardToast(message, "coin");

  return {
    state: {
      ...state,
      avatar,
    },
    success: true,
  };
}

export function joinTeam(state, teamId, options = {}) {
  const t = options.t;
  const team = TEAMS.find((entry) => entry.id === teamId);

  if (!team) {
    return { state, success: false };
  }

  const weekStartDate = getWeekStartDate(options.now);

  if (
    state.team.teamId &&
    state.team.teamId !== teamId &&
    state.team.lastChangeWeekStart === weekStartDate
  ) {
    const message = t
      ? t("rewards.center.team.changeLimit")
      : "You can only change teams once per week.";
    showRewardToast(message, "mission");
    return { state, success: false, reason: "change_limit" };
  }

  const nextState = {
    ...state,
    team: {
      ...state.team,
      teamId,
      joinedAt: getLocalDateKey(options.now),
      weekStartDate,
      lastChangeWeekStart:
        state.team.teamId && state.team.teamId !== teamId
          ? weekStartDate
          : state.team.lastChangeWeekStart,
    },
  };

  const message = t
    ? t("rewards.center.team.joined", { team: t(`rewards.center.team.teams.${teamId}.name`) })
    : `Joined ${teamId}!`;

  showRewardToast(message, "badge");

  return { state: nextState, success: true };
}

export function updateLeaderboardOptIn(state, { displayName, optIn }) {
  return {
    ...state,
    leaderboard: {
      ...state.leaderboard,
      displayName: displayName?.trim() ?? state.leaderboard.displayName,
      optIn: Boolean(optIn),
    },
  };
}

function resolveChestReward(state, chestDef) {
  const picked = pickWeightedReward(chestDef.rewardTable);

  if (picked.type === "coins") {
    return { type: "coins", amount: randomInt(picked.min, picked.max) };
  }

  const pool = getCosmeticPool(picked.itemPool);
  const item = pool.length > 0 ? pool[randomInt(0, pool.length - 1)] : null;

  if (!item) {
    return { type: "coins", amount: DUPLICATE_COSMETIC_COINS.common };
  }

  if (state.avatar.ownedItemIds.includes(item.id)) {
    const duplicateCoins = DUPLICATE_COSMETIC_COINS[item.rarity] ?? DUPLICATE_COSMETIC_COINS.common;
    return { type: "duplicate", itemId: item.id, amount: duplicateCoins };
  }

  return { type: "item", itemId: item.id };
}

export function openMysteryChest(state, chestId, options = {}) {
  const todayKey = getLocalDateKey(options.now);

  if (!state.mysteryChests.availableChestIds.includes(chestId)) {
    return { state, success: false, reason: "not_available" };
  }

  const chestDef = getChestDefinition(chestId);

  if (!chestDef) {
    return { state, success: false, reason: "not_found" };
  }

  const reward = resolveChestReward(state, chestDef);
  let nextState = removeAvailableChest(state, chestId);

  if (reward.type === "coins" || reward.type === "duplicate") {
    nextState = addCoinsToState(nextState, reward.amount);
  }

  if (reward.type === "item") {
    nextState = grantOwnedItem(nextState, reward.itemId);
  }

  if (chestId === "daily_chest") {
    nextState = {
      ...nextState,
      mysteryChests: {
        ...nextState.mysteryChests,
        lastFreeChestDate: todayKey,
      },
    };
  }

  nextState = {
    ...nextState,
    mysteryChests: {
      ...nextState.mysteryChests,
      openedChestHistory: [
        ...nextState.mysteryChests.openedChestHistory,
        {
          chestId,
          date: todayKey,
          reward,
        },
      ],
    },
  };

  return { state: nextState, success: true, reward };
}

export function claimEventMilestone(state, milestoneId, options = {}) {
  const activeEvent = getActiveSeasonalEvent(options.now);

  if (!activeEvent) {
    return { state, success: false, reason: "no_event" };
  }

  const milestone = activeEvent.milestones.find((entry) => entry.id === milestoneId);

  if (!milestone) {
    return { state, success: false, reason: "not_found" };
  }

  if (state.seasonalEvents.claimedMilestoneIds.includes(milestoneId)) {
    return { state, success: false, reason: "already_claimed" };
  }

  const progress = state.seasonalEvents.eventProgress[activeEvent.id] ?? 0;

  if (progress < milestone.target) {
    return { state, success: false, reason: "not_ready" };
  }

  let nextState = {
    ...state,
    seasonalEvents: {
      ...state.seasonalEvents,
      claimedMilestoneIds: [...state.seasonalEvents.claimedMilestoneIds, milestoneId],
    },
  };

  const reward = milestone.reward;

  if (reward.type === "coins") {
    nextState = addCoinsToState(nextState, reward.amount);
  }

  if (reward.type === "badge") {
    nextState = grantBadge(nextState, reward.badgeId);
  }

  if (reward.type === "item") {
    nextState = grantOwnedItem(nextState, reward.itemId);
  }

  if (reward.type === "chest") {
    nextState = addAvailableChest(nextState, reward.chestId);
  }

  return { state: nextState, success: true, reward };
}

export function getAvatarPreview(state) {
  const avatar = state.avatar;
  const selectedAvatar = getShopItem(avatar.selectedAvatarId);
  const frame = avatar.selectedFrameId ? getShopItem(avatar.selectedFrameId) : null;
  const background = avatar.selectedBackgroundId ? getShopItem(avatar.selectedBackgroundId) : null;
  const accessories = avatar.selectedAccessoryIds
    .map((id) => getShopItem(id))
    .filter(Boolean);
  const effect = avatar.selectedEffectId ? getShopItem(avatar.selectedEffectId) : null;

  return {
    avatar: selectedAvatar,
    frame,
    background,
    accessories,
    effect,
  };
}

export function isItemEquipped(state, itemId) {
  const { avatar } = state;

  return (
    avatar.selectedAvatarId === itemId ||
    avatar.selectedFrameId === itemId ||
    avatar.selectedBackgroundId === itemId ||
    avatar.selectedAccessoryIds.includes(itemId) ||
    avatar.selectedEffectId === itemId
  );
}

export function getLeaderboardEntries(state) {
  if (!state.leaderboard.optIn || !state.leaderboard.displayName.trim()) {
    return [];
  }

  const scores = state.leaderboard.weeklyScores;

  return [
    {
      userId: state.leaderboard.anonymousId,
      displayName: state.leaderboard.displayName.trim(),
      avatar: getAvatarPreview(state),
      teamId: state.team.teamId,
      scores: {
        improvementScore: scores.improvementScore,
        currentStreak: state.currentStreak,
        mistakesFixed: scores.mistakesFixed,
        wordsReviewed: scores.wordsReviewed,
        quizAccuracy: scores.quizAccuracy,
        teamPoints: scores.teamPoints,
        quizzesCompleted: scores.quizzesCompleted,
      },
      isCurrentUser: true,
    },
  ];
}

export function getTeamProgress(state) {
  const points = state.team.currentWeekTeamPoints;

  return {
    points,
    goal: TEAM_WEEKLY_GOAL,
    percent: Math.min(100, Math.round((points / TEAM_WEEKLY_GOAL) * 100)),
    helperThreshold: TEAM_HELPER_POINT_THRESHOLD,
    helperEarned: points >= TEAM_HELPER_POINT_THRESHOLD,
  };
}

export function getSeasonalEventView(state, now = new Date()) {
  const activeEvent = getActiveSeasonalEvent(now);

  if (!activeEvent) {
    return null;
  }

  const progress = state.seasonalEvents.eventProgress[activeEvent.id] ?? 0;

  return {
    ...activeEvent,
    progress,
    milestones: activeEvent.milestones.map((milestone) => ({
      ...milestone,
      claimed: state.seasonalEvents.claimedMilestoneIds.includes(milestone.id),
      ready: progress >= milestone.target,
    })),
  };
}

export function getChestViews(state, now = new Date()) {
  const synced = syncAvailableChests(state, now);

  return synced.mysteryChests.availableChestIds.map((chestId) => {
    const def = getChestDefinition(chestId);

    return {
      id: chestId,
      icon: def?.icon ?? "🎁",
    };
  });
}

export function loadSyncedRewardState(storage, now = new Date()) {
  const rawState = loadRewardState(storage, now);
  const syncedState = syncRewardExtensions(rawState, now);

  if (JSON.stringify(rawState) !== JSON.stringify(syncedState)) {
    saveRewardState(syncedState, storage);
  }

  return syncedState;
}

export function updateSyncedRewardState(mutator, options = {}) {
  const storage = options.storage;
  const latestState = loadSyncedRewardState(storage, options.now);
  const result = mutator(latestState);

  if (result.success) {
    saveRewardState(result.state, storage);
  }

  return result;
}
