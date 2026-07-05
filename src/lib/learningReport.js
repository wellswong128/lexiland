import { getLocalDateKey, loadLearningActivity } from "./learningActivity.js";
import { dedupeWordsByTerm } from "../features/words/wordTypes.js";
import { loadRewardState } from "../features/rewards/rewardsStore.js";
import { getWeeklyRewardSummary } from "../features/rewards/rewardsEngine.js";

const WEEKDAY_COUNT = 7;
const TOP_MISTAKE_LIMIT = 10;

function getDefaultStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function getWeekDateKeys(now = new Date()) {
  const keys = [];

  for (let offset = WEEKDAY_COUNT - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    keys.push(getLocalDateKey(date));
  }

  return keys;
}

function getWeekStartDate(now = new Date()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (WEEKDAY_COUNT - 1));

  return date;
}

function isWithinCurrentWeek(isoDate, now = new Date()) {
  if (!isoDate) {
    return false;
  }

  const date = new Date(isoDate);
  const weekStart = getWeekStartDate(now);
  const weekEnd = new Date(now);
  weekEnd.setHours(23, 59, 59, 999);

  return date >= weekStart && date <= weekEnd;
}

function getMistakeScore(word) {
  const mistakeCount = Math.max(Number(word.mistake?.mistakeCount) || 0, 0);
  const incorrectCount = Math.max(Number(word.review?.incorrectCount) || 0, 0);

  if (mistakeCount > 0) {
    return mistakeCount;
  }

  return incorrectCount;
}

export function getWordsAddedThisWeek(words, now = new Date()) {
  return words.filter((word) => isWithinCurrentWeek(word.createdAt, now));
}

export function getWordsReviewedThisWeek(words, now = new Date()) {
  return words.filter((word) => isWithinCurrentWeek(word.review?.lastReviewedAt, now));
}

export function getTopMistakeWords(words, limit = TOP_MISTAKE_LIMIT) {
  return dedupeWordsByTerm(words)
    .map((word) => ({
      word,
      mistakeCount: getMistakeScore(word),
      isActiveMistake: Boolean(word.mistake?.isMistake),
    }))
    .filter((item) => item.mistakeCount > 0)
    .sort((left, right) => {
      if (right.mistakeCount !== left.mistakeCount) {
        return right.mistakeCount - left.mistakeCount;
      }

      if (right.isActiveMistake !== left.isActiveMistake) {
        return Number(right.isActiveMistake) - Number(left.isActiveMistake);
      }

      return left.word.term.localeCompare(right.word.term);
    })
    .slice(0, limit);
}

export function getGamesCompletedThisWeek(activity, now = new Date()) {
  const weekKeys = getWeekDateKeys(now);

  return weekKeys.reduce((total, dateKey) => {
    const gamesPlayed = activity.dailyStats?.[dateKey]?.gamesPlayed;

    return total + Math.max(Number(gamesPlayed) || 0, 0);
  }, 0);
}

export function getGamesCompletedTotal(activity) {
  return Object.values(activity.dailyStats || {}).reduce((total, dayStats) => {
    return total + Math.max(Number(dayStats?.gamesPlayed) || 0, 0);
  }, 0);
}

export function getLearningReport(words, storage = getDefaultStorage(), now = new Date()) {
  const activity = loadLearningActivity(storage);
  const rewardState = loadRewardState(storage, now);
  const rewardSummary = getWeeklyRewardSummary(rewardState, words);
  const wordsAddedThisWeek = getWordsAddedThisWeek(words, now);
  const wordsReviewedThisWeek = getWordsReviewedThisWeek(words, now);
  const topMistakeWords = getTopMistakeWords(words);
  const gamesCompletedThisWeek = getGamesCompletedThisWeek(activity, now);
  const gamesCompletedTotal = getGamesCompletedTotal(activity);
  const weekStart = getWeekStartDate(now);

  return {
    weekStartDate: weekStart.toISOString(),
    weekEndDate: now.toISOString(),
    totalWords: dedupeWordsByTerm(words).length,
    wordsAddedThisWeek: Math.max(wordsAddedThisWeek.length, rewardSummary.wordsAdded),
    wordsReviewedThisWeek: Math.max(
      wordsReviewedThisWeek.length,
      rewardSummary.wordsReviewed,
    ),
    streakDays: rewardSummary.currentStreak,
    longestStreakDays: rewardSummary.longestStreak,
    gamesCompletedThisWeek: Math.max(gamesCompletedThisWeek, rewardSummary.gamesPlayed),
    gamesCompletedTotal,
    topMistakeWords,
    activeMistakeCount: dedupeWordsByTerm(words).filter((word) => word.mistake?.isMistake)
      .length,
    rewardSummary,
  };
}
