export const BADGE_DEFINITIONS = [
  {
    id: "first_snap",
    icon: "📸",
    check: (ctx) => ctx.allTimeStats.totalPhotoAdds >= 1,
  },
  {
    id: "word_collector_50",
    icon: "📚",
    check: (ctx) => ctx.allTimeStats.totalWordsAdded >= 50,
  },
  {
    id: "flashcard_starter_20",
    icon: "🃏",
    check: (ctx) => ctx.allTimeStats.totalWordsReviewed >= 20,
  },
  {
    id: "quiz_rookie_5",
    icon: "🏆",
    check: (ctx) => ctx.allTimeStats.totalQuizzesCompleted >= 5,
  },
  {
    id: "mistake_fixer_30",
    icon: "🛠️",
    check: (ctx) => ctx.allTimeStats.totalMistakesFixed >= 30,
  },
  {
    id: "streak_3",
    icon: "⭐",
    check: (ctx) => ctx.currentStreak >= 3,
  },
  {
    id: "streak_7",
    icon: "🔥",
    check: (ctx) => ctx.currentStreak >= 7,
  },
  {
    id: "streak_14",
    icon: "🌟",
    check: (ctx) => ctx.currentStreak >= 14,
  },
  {
    id: "streak_30",
    icon: "💎",
    check: (ctx) => ctx.currentStreak >= 30,
  },
  {
    id: "streak_60",
    icon: "👑",
    check: (ctx) => ctx.currentStreak >= 60,
  },
  {
    id: "streak_100",
    icon: "🏅",
    check: (ctx) => ctx.currentStreak >= 100,
  },
  {
    id: "dictation_ready",
    icon: "✅",
    check: (ctx) => ctx.dueWords === 0 && (ctx.allTimeStats.latestQuizScore ?? 0) >= 80,
  },
  {
    id: "team_helper",
    icon: "🤝",
    check: (ctx) => ctx.earnedBadges.includes("team_helper"),
  },
  {
    id: "summer_badge",
    icon: "☀️",
    check: (ctx) => ctx.earnedBadges.includes("summer_badge"),
  },
  {
    id: "school_star",
    icon: "🎒",
    check: (ctx) => ctx.earnedBadges.includes("school_star"),
  },
  {
    id: "snow_badge",
    icon: "❄️",
    check: (ctx) => ctx.earnedBadges.includes("snow_badge"),
  },
];

export function getBadgeDefinition(badgeId) {
  return BADGE_DEFINITIONS.find((badge) => badge.id === badgeId) ?? null;
}
