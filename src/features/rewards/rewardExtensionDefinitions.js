export const AVATAR_SHOP_CATEGORIES = {
  AVATAR: "avatar",
  ACCESSORY: "accessory",
  FRAME: "frame",
  BACKGROUND: "background",
  EFFECT: "effect",
};

export const AVATAR_SHOP_ITEMS = [
  { id: "lexi_monster_blue", category: "avatar", price: 0, icon: "🐉", rarity: "starter" },
  { id: "lexi_monster_green", category: "avatar", price: 150, icon: "🟢", rarity: "common" },
  { id: "lexi_monster_pink", category: "avatar", price: 150, icon: "🌸", rarity: "common" },
  { id: "lexi_monster_gold", category: "avatar", price: 500, icon: "⭐", rarity: "rare" },
  { id: "wizard_hat", category: "accessory", price: 120, icon: "🧙", rarity: "common" },
  { id: "ninja_headband", category: "accessory", price: 120, icon: "🥷", rarity: "common" },
  { id: "crown", category: "accessory", price: 300, icon: "👑", rarity: "rare" },
  { id: "smart_glasses", category: "accessory", price: 100, icon: "🤓", rarity: "common" },
  { id: "rainbow_frame", category: "frame", price: 200, icon: "🌈", rarity: "common" },
  { id: "fire_frame", category: "frame", price: 250, icon: "🔥", rarity: "common" },
  { id: "diamond_frame", category: "frame", price: 400, icon: "💎", rarity: "rare" },
  { id: "ocean_theme", category: "background", price: 180, icon: "🌊", rarity: "common" },
  { id: "space_theme", category: "background", price: 220, icon: "🚀", rarity: "common" },
  { id: "candy_theme", category: "background", price: 180, icon: "🍬", rarity: "common" },
  { id: "sparkle_effect", category: "effect", price: 160, icon: "✨", rarity: "common" },
  { id: "fire_trail_effect", category: "effect", price: 220, icon: "🔥", rarity: "common" },
  { id: "bubble_effect", category: "effect", price: 160, icon: "🫧", rarity: "common" },
  { id: "summer_background", category: "background", price: 0, icon: "☀️", rarity: "exclusive", eventOnly: true },
  { id: "pencil_crown", category: "accessory", price: 0, icon: "✏️", rarity: "exclusive", eventOnly: true },
  { id: "pumpkin_frame", category: "frame", price: 0, icon: "🎃", rarity: "exclusive", eventOnly: true },
  { id: "snow_background", category: "background", price: 0, icon: "❄️", rarity: "exclusive", eventOnly: true },
];

export const TEAMS = [
  { id: "blue_dragon", color: "blue", icon: "🐉" },
  { id: "red_phoenix", color: "red", icon: "🔥" },
  { id: "green_turtle", color: "green", icon: "🐢" },
  { id: "golden_tiger", color: "yellow", icon: "🐯" },
];

export const TEAM_POINT_RULES = {
  add_word: 1,
  review_word: 1,
  complete_quiz: 10,
  play_game: 5,
  fix_mistake: 3,
  daily_hero_bonus: 20,
  streak_safe: 5,
};

export const TEAM_WEEKLY_GOAL = 100;
export const TEAM_HELPER_POINT_THRESHOLD = 50;
export const TEAM_HELPER_COIN_REWARD = 100;

export const LEADERBOARD_CATEGORIES = [
  { id: "improvement", scoreKey: "improvementScore" },
  { id: "streak", scoreKey: "currentStreak", useStateStreak: true },
  { id: "mistakesFixed", scoreKey: "mistakesFixed" },
  { id: "wordsReviewed", scoreKey: "wordsReviewed" },
  { id: "quizAccuracy", scoreKey: "quizAccuracy", minQuizzes: 2 },
  { id: "teamPoints", scoreKey: "teamPoints" },
];

export const STREAK_CHEST_MILESTONES = [7, 14, 30, 60, 100];

export const CHEST_DEFINITIONS = [
  {
    id: "daily_chest",
    icon: "🎁",
    rewardTable: [
      { type: "coins", min: 10, max: 30, weight: 90 },
      { type: "cosmetic", itemPool: "common", weight: 10 },
    ],
  },
  {
    id: "mission_chest",
    icon: "⭐",
    rewardTable: [
      { type: "coins", min: 30, max: 80, weight: 80 },
      { type: "cosmetic", itemPool: "common", weight: 15 },
      { type: "cosmetic", itemPool: "rare", weight: 5 },
    ],
  },
];

export const DUPLICATE_COSMETIC_COINS = {
  common: 50,
  rare: 120,
  exclusive: 250,
};

export const SEASONAL_EVENTS = [
  {
    id: "summer_vocab_quest",
    theme: "☀️",
    startMonth: 6,
    startDay: 1,
    endMonth: 8,
    endDay: 31,
    progressKey: "wordsReviewed",
    goal: 100,
    milestones: [
      { id: "summer_25", target: 25, reward: { type: "coins", amount: 50 } },
      { id: "summer_50", target: 50, reward: { type: "badge", badgeId: "summer_badge" } },
      { id: "summer_100", target: 100, reward: { type: "item", itemId: "summer_background" } },
    ],
  },
  {
    id: "back_to_school",
    theme: "🎒",
    startMonth: 9,
    startDay: 1,
    endMonth: 9,
    endDay: 30,
    progressKey: "wordsAdded",
    goal: 50,
    milestones: [
      { id: "school_10", target: 10, reward: { type: "coins", amount: 30 } },
      { id: "school_25", target: 25, reward: { type: "badge", badgeId: "school_star" } },
      { id: "school_50", target: 50, reward: { type: "item", itemId: "pencil_crown" } },
    ],
  },
  {
    id: "halloween_word_hunt",
    theme: "🎃",
    startMonth: 10,
    startDay: 1,
    endMonth: 10,
    endDay: 31,
    progressKey: "mistakesFixed",
    goal: 50,
    milestones: [
      { id: "halloween_10", target: 10, reward: { type: "coins", amount: 30 } },
      { id: "halloween_25", target: 25, reward: { type: "item", itemId: "pumpkin_frame" } },
      { id: "halloween_50", target: 50, reward: { type: "chest", chestId: "event_chest" } },
    ],
  },
  {
    id: "winter_review_festival",
    theme: "❄️",
    startMonth: 12,
    startDay: 1,
    endMonth: 12,
    endDay: 31,
    progressKey: "quizzesCompleted",
    goal: 20,
    milestones: [
      { id: "winter_5", target: 5, reward: { type: "coins", amount: 50 } },
      { id: "winter_10", target: 10, reward: { type: "badge", badgeId: "snow_badge" } },
      { id: "winter_20", target: 20, reward: { type: "item", itemId: "snow_background" } },
    ],
  },
];

export function getShopItem(itemId) {
  return AVATAR_SHOP_ITEMS.find((item) => item.id === itemId) ?? null;
}

export function getTeam(teamId) {
  return TEAMS.find((team) => team.id === teamId) ?? null;
}

export function getChestDefinition(chestId) {
  if (chestId === "event_chest") {
    return {
      id: "event_chest",
      icon: "🎃",
      rewardTable: [
        { type: "coins", min: 50, max: 120, weight: 70 },
        { type: "cosmetic", itemPool: "rare", weight: 20 },
        { type: "cosmetic", itemPool: "exclusive", weight: 10 },
      ],
    };
  }

  if (chestId.startsWith("streak_chest_")) {
    return {
      id: chestId,
      icon: "🔥",
      rewardTable: [
        { type: "coins", min: 100, max: 500, weight: 60 },
        { type: "cosmetic", itemPool: "rare", weight: 25 },
        { type: "cosmetic", itemPool: "exclusive", weight: 15 },
      ],
    };
  }

  return CHEST_DEFINITIONS.find((chest) => chest.id === chestId) ?? null;
}

export function getActiveSeasonalEvent(now = new Date()) {
  const month = now.getMonth() + 1;
  const day = now.getDate();

  return (
    SEASONAL_EVENTS.find((event) => {
      const start = event.startMonth * 100 + event.startDay;
      const end = event.endMonth * 100 + event.endDay;
      const current = month * 100 + day;

      if (start <= end) {
        return current >= start && current <= end;
      }

      return current >= start || current <= end;
    }) ?? null
  );
}

export function getCosmeticPool(poolName) {
  return AVATAR_SHOP_ITEMS.filter((item) => {
    if (item.eventOnly) {
      return poolName === "exclusive";
    }

    if (poolName === "common") {
      return item.rarity === "common" && !item.eventOnly;
    }

    if (poolName === "rare") {
      return item.rarity === "rare";
    }

    if (poolName === "exclusive") {
      return item.rarity === "exclusive";
    }

    return false;
  });
}
