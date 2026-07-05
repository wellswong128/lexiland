import { ACTION_TYPES } from "./rewardConstants.js";

export const MISSION_POOL = [
  {
    id: "add_words",
    actionType: ACTION_TYPES.ADD_WORD,
    target: 3,
    rewardCoins: 20,
    to: "/words/new?tab=manual",
    emoji: "＋",
  },
  {
    id: "review_flashcards",
    actionType: ACTION_TYPES.REVIEW_WORD,
    target: 5,
    rewardCoins: 20,
    to: "/review/flashcards",
    emoji: "🃏",
  },
  {
    id: "complete_quiz",
    actionType: ACTION_TYPES.COMPLETE_QUIZ,
    target: 1,
    rewardCoins: 30,
    to: "/review/quiz",
    emoji: "🏆",
  },
  {
    id: "play_game",
    actionType: ACTION_TYPES.PLAY_GAME,
    target: 1,
    rewardCoins: 15,
    to: "/games/spelling-ninja",
    emoji: "🎮",
  },
  {
    id: "fix_mistakes",
    actionType: ACTION_TYPES.FIX_MISTAKE,
    target: 3,
    rewardCoins: 30,
    to: "/mistakes",
    emoji: "🛠️",
  },
  {
    id: "photo_add",
    actionType: ACTION_TYPES.PHOTO_ADD,
    target: 1,
    rewardCoins: 25,
    to: "/words/new?tab=photo",
    emoji: "📸",
  },
];

export function getMissionDefinition(missionId) {
  return MISSION_POOL.find((mission) => mission.id === missionId) ?? null;
}

export function selectDailyMissions(dateKey) {
  const pool = [...MISSION_POOL];
  let seed = 0;

  for (const character of dateKey) {
    seed += character.charCodeAt(0);
  }

  const selected = [];

  for (let index = 0; index < 3 && pool.length > 0; index += 1) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const pickIndex = seed % pool.length;
    selected.push(pool.splice(pickIndex, 1)[0]);
  }

  return selected.map((mission) => ({
    missionId: mission.id,
    progress: 0,
    completed: false,
    claimed: false,
  }));
}
