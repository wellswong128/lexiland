import { getDueWords } from "../features/review/reviewHelpers.js";
import { loadRewardState } from "../features/rewards/rewardsStore.js";
import { REVIEW_RESULTS, WORD_SOURCES } from "../features/words/wordTypes.js";
import { getTodayReviewedCount, loadLearningActivity } from "./learningActivity.js";

export const GAME_PATHS = [
  "/games/spelling-ninja",
  "/games/fishing-blast",
  "/games/deep-sea-fishing",
  "/games/word-kart",
  "/games/battle-jet",
  "/games/penalty-twelve",
  "/games/speed-racing",
];

export const ACHIEVEMENT_CATEGORIES = {
  LEARNING: "learning",
  CONSISTENCY: "consistency",
  GAMES: "games",
};

const CORRECT_RESULTS = new Set([REVIEW_RESULTS.CORRECT, REVIEW_RESULTS.REMEMBERED]);

function countTotalCorrect(words) {
  return words.reduce((sum, word) => sum + (word.review?.correctCount || 0), 0);
}

function countPhotoWords(words) {
  return words.filter((word) => word.source === WORD_SOURCES.PHOTO).length;
}

function countMistakeWords(words) {
  return words.filter((word) => word.mistake?.isMistake).length;
}

function hasBounceBack(words) {
  return words.some(
    (word) =>
      (word.mistake?.mistakeCount || 0) > 0 &&
      !word.mistake?.isMistake &&
      CORRECT_RESULTS.has(word.review?.lastResult),
  );
}

function countVisitedGames(visitedPaths = []) {
  return GAME_PATHS.filter((path) => visitedPaths.includes(path)).length;
}

function hasVisitedPath(visitedPaths, path) {
  return visitedPaths.includes(path);
}

export function buildAchievementContext(words, storage) {
  const activity = loadLearningActivity(storage);
  const rewardState = loadRewardState(storage);
  const dueWords = getDueWords(words);
  const visitedPaths = activity.visitedPaths || [];

  return {
    words,
    wordCount: words.length,
    dueCount: dueWords.length,
    mistakeCount: countMistakeWords(words),
    photoWordCount: countPhotoWords(words),
    totalCorrect: countTotalCorrect(words),
    streak: rewardState.currentStreak || 0,
    todayReviewed: getTodayReviewedCount(words),
    visitedPaths,
    visitedGameCount: countVisitedGames(visitedPaths),
    hasBounceBack: hasBounceBack(words),
    hasQuizVisit: hasVisitedPath(visitedPaths, "/review/quiz"),
    hasFlashcardsVisit: hasVisitedPath(visitedPaths, "/review/flashcards"),
    hasAnyReview: words.some((word) => Boolean(word.review?.lastReviewedAt)),
  };
}

export const ACHIEVEMENTS = [
  {
    id: "firstWord",
    category: ACHIEVEMENT_CATEGORIES.LEARNING,
    emoji: "📚",
    target: 1,
    evaluate: (ctx) => ({
      current: Math.min(ctx.wordCount, 1),
      unlocked: ctx.wordCount >= 1,
    }),
  },
  {
    id: "firstPhotoWord",
    category: ACHIEVEMENT_CATEGORIES.LEARNING,
    emoji: "📸",
    target: 1,
    evaluate: (ctx) => ({
      current: Math.min(ctx.photoWordCount, 1),
      unlocked: ctx.photoWordCount >= 1,
    }),
  },
  {
    id: "words10",
    category: ACHIEVEMENT_CATEGORIES.LEARNING,
    emoji: "🌱",
    target: 10,
    evaluate: (ctx) => ({
      current: Math.min(ctx.wordCount, 10),
      unlocked: ctx.wordCount >= 10,
    }),
  },
  {
    id: "words50",
    category: ACHIEVEMENT_CATEGORIES.LEARNING,
    emoji: "🌳",
    target: 50,
    evaluate: (ctx) => ({
      current: Math.min(ctx.wordCount, 50),
      unlocked: ctx.wordCount >= 50,
    }),
  },
  {
    id: "correct10",
    category: ACHIEVEMENT_CATEGORIES.LEARNING,
    emoji: "✅",
    target: 10,
    evaluate: (ctx) => ({
      current: Math.min(ctx.totalCorrect, 10),
      unlocked: ctx.totalCorrect >= 10,
    }),
  },
  {
    id: "allCaughtUp",
    category: ACHIEVEMENT_CATEGORIES.LEARNING,
    emoji: "🏅",
    target: 1,
    evaluate: (ctx) => ({
      current: ctx.wordCount > 0 && ctx.dueCount === 0 ? 1 : 0,
      unlocked: ctx.wordCount > 0 && ctx.dueCount === 0,
    }),
  },
  {
    id: "mistakeFixer",
    category: ACHIEVEMENT_CATEGORIES.LEARNING,
    emoji: "💪",
    target: 1,
    evaluate: (ctx) => {
      const hadMistakes = ctx.words.some((word) => (word.mistake?.mistakeCount || 0) > 0);

      return {
        current: hadMistakes && ctx.mistakeCount === 0 ? 1 : 0,
        unlocked: hadMistakes && ctx.mistakeCount === 0,
      };
    },
  },
  {
    id: "bounceBack",
    category: ACHIEVEMENT_CATEGORIES.LEARNING,
    emoji: "🐉",
    target: 1,
    evaluate: (ctx) => ({
      current: ctx.hasBounceBack ? 1 : 0,
      unlocked: ctx.hasBounceBack,
    }),
  },
  {
    id: "firstReview",
    category: ACHIEVEMENT_CATEGORIES.LEARNING,
    emoji: "🃏",
    target: 1,
    evaluate: (ctx) => ({
      current: ctx.hasAnyReview || ctx.hasFlashcardsVisit ? 1 : 0,
      unlocked: ctx.hasAnyReview || ctx.hasFlashcardsVisit,
    }),
  },
  {
    id: "firstQuiz",
    category: ACHIEVEMENT_CATEGORIES.LEARNING,
    emoji: "📝",
    target: 1,
    evaluate: (ctx) => ({
      current: ctx.hasQuizVisit ? 1 : 0,
      unlocked: ctx.hasQuizVisit,
    }),
  },
  {
    id: "streak3",
    category: ACHIEVEMENT_CATEGORIES.CONSISTENCY,
    emoji: "🔥",
    target: 3,
    evaluate: (ctx) => ({
      current: Math.min(ctx.streak, 3),
      unlocked: ctx.streak >= 3,
    }),
  },
  {
    id: "streak7",
    category: ACHIEVEMENT_CATEGORIES.CONSISTENCY,
    emoji: "🌟",
    target: 7,
    evaluate: (ctx) => ({
      current: Math.min(ctx.streak, 7),
      unlocked: ctx.streak >= 7,
    }),
  },
  {
    id: "gameExplorer",
    category: ACHIEVEMENT_CATEGORIES.GAMES,
    emoji: "🎮",
    target: GAME_PATHS.length,
    evaluate: (ctx) => ({
      current: ctx.visitedGameCount,
      unlocked: ctx.visitedGameCount >= GAME_PATHS.length,
    }),
  },
];

export function getAchievementStates(words, storage) {
  const context = buildAchievementContext(words, storage);

  return ACHIEVEMENTS.map((achievement) => {
    const { current, unlocked } = achievement.evaluate(context);
    const target = achievement.target;
    const progress = target > 0 ? Math.min(current / target, 1) : unlocked ? 1 : 0;

    return {
      ...achievement,
      current,
      target,
      unlocked,
      progress,
    };
  });
}

export function getAchievementsSummary(words, storage) {
  const achievements = getAchievementStates(words, storage);
  const unlockedCount = achievements.filter((achievement) => achievement.unlocked).length;

  return {
    achievements,
    unlockedCount,
    totalCount: achievements.length,
  };
}

export function getNextAchievementGoal(achievements) {
  const locked = achievements
    .filter((achievement) => !achievement.unlocked && achievement.target > 1)
    .sort((left, right) => right.progress - left.progress);

  return locked[0] || null;
}

export { getTodayReviewedCount };
