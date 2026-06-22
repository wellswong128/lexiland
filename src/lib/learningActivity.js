import { REVIEW_RESULTS } from "../features/words/wordTypes.js";

export const LEARNING_ACTIVITY_KEY = "lexiland.learningActivity.v1";

export const DAILY_TASK_TARGETS = {
  reviewWords: 5,
  gamesPlayed: 1,
  mistakesCleared: 3,
};

const defaultActivity = {
  currentStreak: 0,
  lastActiveDate: null,
  lastActivity: null,
  visitedPaths: [],
  dailyStats: {},
};

function getDefaultStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getPreviousDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);

  return getLocalDateKey(date);
}

export function loadLearningActivity(storage = getDefaultStorage()) {
  if (!storage) {
    return { ...defaultActivity };
  }

  const rawValue = storage.getItem(LEARNING_ACTIVITY_KEY);

  if (!rawValue) {
    return { ...defaultActivity };
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (!parsedValue || typeof parsedValue !== "object") {
      return { ...defaultActivity };
    }

    return {
      ...defaultActivity,
      ...parsedValue,
      visitedPaths: Array.isArray(parsedValue.visitedPaths) ? parsedValue.visitedPaths : [],
      dailyStats:
        parsedValue.dailyStats && typeof parsedValue.dailyStats === "object"
          ? parsedValue.dailyStats
          : {},
    };
  } catch (error) {
    console.warn("Could not parse stored learning activity.", error);
    return { ...defaultActivity };
  }
}

export function saveLearningActivity(activity, storage = getDefaultStorage()) {
  if (!storage) {
    return;
  }

  storage.setItem(LEARNING_ACTIVITY_KEY, JSON.stringify(activity));
}

function applyStreak(activity, dateKey) {
  if (activity.lastActiveDate === dateKey) {
    return activity;
  }

  const previousDateKey = getPreviousDateKey(dateKey);
  const nextStreak =
    activity.lastActiveDate === previousDateKey
      ? Math.max(activity.currentStreak || 0, 0) + 1
      : 1;

  return {
    ...activity,
    currentStreak: nextStreak,
    lastActiveDate: dateKey,
  };
}

export function recordLearningActivity(partial, storage = getDefaultStorage()) {
  const dateKey = getLocalDateKey();
  const currentActivity = loadLearningActivity(storage);
  const withStreak = applyStreak(currentActivity, dateKey);
  const path = partial.path;
  const visitedPaths = [...(withStreak.visitedPaths || [])];

  if (path && !visitedPaths.includes(path)) {
    visitedPaths.push(path);
  }

  const nextActivity = {
    ...withStreak,
    visitedPaths,
    lastActivity: {
      ...partial,
      recordedAt: new Date().toISOString(),
    },
  };

  saveLearningActivity(nextActivity, storage);

  return nextActivity;
}

export function getTodayReviewedCount(words, now = new Date()) {
  const todayKey = getLocalDateKey(now);

  return words.filter((word) => {
    const reviewedAt = word.review?.lastReviewedAt;

    if (!reviewedAt) {
      return false;
    }

    return getLocalDateKey(new Date(reviewedAt)) === todayKey;
  }).length;
}

function getTodayDailyStats(activity, dateKey = getLocalDateKey()) {
  const todayStats = activity.dailyStats?.[dateKey];

  if (!todayStats || typeof todayStats !== "object") {
    return {
      gamesPlayed: 0,
      mistakesCleared: 0,
    };
  }

  return {
    gamesPlayed: Math.max(Number(todayStats.gamesPlayed) || 0, 0),
    mistakesCleared: Math.max(Number(todayStats.mistakesCleared) || 0, 0),
  };
}

function incrementTodayDailyStat(statKey, amount = 1, storage = getDefaultStorage()) {
  if (!storage || amount <= 0) {
    return loadLearningActivity(storage);
  }

  const dateKey = getLocalDateKey();
  const activity = loadLearningActivity(storage);
  const todayStats = getTodayDailyStats(activity, dateKey);
  const nextTodayStats = {
    ...todayStats,
    [statKey]: todayStats[statKey] + amount,
  };

  const nextActivity = {
    ...activity,
    dailyStats: {
      ...(activity.dailyStats || {}),
      [dateKey]: nextTodayStats,
    },
  };

  saveLearningActivity(nextActivity, storage);

  return nextActivity;
}

export function recordDailyGameCompleted(storage = getDefaultStorage()) {
  return incrementTodayDailyStat("gamesPlayed", 1, storage);
}

export function recordDailyMistakeCleared(amount = 1, storage = getDefaultStorage()) {
  return incrementTodayDailyStat("mistakesCleared", amount, storage);
}

export function maybeRecordDailyMistakeClear(word, result, storage = getDefaultStorage()) {
  const remembered =
    result === REVIEW_RESULTS.REMEMBERED || result === REVIEW_RESULTS.CORRECT;

  if (word?.mistake?.isMistake && remembered) {
    recordDailyMistakeCleared(1, storage);
  }
}

export function getDailyTasks(words, storage = getDefaultStorage()) {
  const activity = loadLearningActivity(storage);
  const todayStats = getTodayDailyStats(activity);
  const reviewCurrent = getTodayReviewedCount(words);
  const reviewTarget = DAILY_TASK_TARGETS.reviewWords;
  const gamesTarget = DAILY_TASK_TARGETS.gamesPlayed;
  const mistakesTarget = DAILY_TASK_TARGETS.mistakesCleared;
  const gamesCurrent = Math.min(todayStats.gamesPlayed, gamesTarget);
  const mistakesCurrent = Math.min(todayStats.mistakesCleared, mistakesTarget);

  const tasks = [
    {
      id: "reviewWords",
      current: Math.min(reviewCurrent, reviewTarget),
      target: reviewTarget,
      done: reviewCurrent >= reviewTarget,
      to: "/review/flashcards",
      emoji: "📒",
    },
    {
      id: "playGame",
      current: gamesCurrent,
      target: gamesTarget,
      done: todayStats.gamesPlayed >= gamesTarget,
      to: "/games/spelling-ninja",
      emoji: "🎮",
    },
    {
      id: "clearMistakes",
      current: mistakesCurrent,
      target: mistakesTarget,
      done: todayStats.mistakesCleared >= mistakesTarget,
      to: "/mistakes",
      emoji: "📕",
    },
  ];

  const completedCount = tasks.filter((task) => task.done).length;

  return {
    tasks,
    completedCount,
    totalCount: tasks.length,
    allDone: completedCount === tasks.length,
  };
}

export function getLearningSnapshot(words, storage = getDefaultStorage()) {
  const activity = loadLearningActivity(storage);

  return {
    streak: activity.currentStreak || 0,
    todayReviewed: getTodayReviewedCount(words),
    lastActivity: activity.lastActivity,
    dailyTasks: getDailyTasks(words, storage),
  };
}

export const PAGE_ACTIVITIES = {
  "/games/spelling-ninja": {
    kind: "game",
    labelKey: "nav.ninjaGame",
    icon: "🥷",
  },
  "/games/fishing-blast": {
    kind: "game",
    labelKey: "nav.fishBlast",
    icon: "🐟",
  },
  "/games/word-kart": {
    kind: "game",
    labelKey: "nav.wordKart",
    icon: "🏎️",
  },
  "/games/battle-jet": {
    kind: "game",
    labelKey: "nav.battleJet",
    icon: "✈️",
  },
  "/games/penalty-twelve": {
    kind: "game",
    labelKey: "nav.penaltyTwelve",
    icon: "⚽",
  },
  "/games/speed-racing": {
    kind: "game",
    labelKey: "nav.speedRacing",
    icon: "🏁",
  },
  "/review/quiz": {
    kind: "quiz",
    labelKey: "home.startQuiz",
    icon: "📝",
  },
  "/mistakes": {
    kind: "mistakes",
    labelKey: "nav.mistakes",
    icon: "📕",
  },
};

export function getActivityForLocation(pathname, search = "") {
  const directMatch = PAGE_ACTIVITIES[pathname];

  if (directMatch) {
    return {
      ...directMatch,
      path: pathname,
    };
  }

  if (pathname === "/review/flashcards") {
    const mistakesOnly = new URLSearchParams(search).get("mode") === "mistakes";

    return {
      kind: mistakesOnly ? "mistakes" : "flashcards",
      labelKey: mistakesOnly ? "nav.mistakes" : "home.flashcards",
      icon: mistakesOnly ? "📕" : "🃏",
      path: `${pathname}${search}`,
    };
  }

  return null;
}

export function clearLearningActivity(storage = getDefaultStorage()) {
  if (!storage) {
    return;
  }

  storage.removeItem(LEARNING_ACTIVITY_KEY);
}
