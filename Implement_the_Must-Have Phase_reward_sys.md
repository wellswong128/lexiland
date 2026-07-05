You are helping me implement the Must-Have Phase reward system for my app “LexiLand”.

The app already has these learning features:
- Snap textbook / Photo Add
- Add Word manually
- Word List
- Flashcards
- Start Quiz
- Records / Learning Progress
- Featured Games
- Home page showing:
  - Reviewed Today
  - Day Streak
  - Words
  - Due
  - Mistakes

Please implement the Must-Have Phase reward system:

1. Daily Streak
2. Daily Missions
3. Coins
4. Badges
5. Weekly Parent / Teacher Report integration

Important design principle:
Students should only keep or increase their daily streak when they complete at least one meaningful learning action, not just by opening the app.

Meaningful learning actions include:
- Add 3 new words
- Review 5 flashcards
- Complete 1 quiz
- Play 1 learning game
- Fix 3 mistake words
- Use Photo Add / Snap Textbook once

====================================================
FEATURE 1: DAILY STREAK
====================================================

Implement a daily streak system.

Rules:
- Do not increase streak on app open.
- Increase or preserve streak only when the student completes at least one meaningful learning action today.
- If the student completed a meaningful action yesterday and completes one today, streak increases by 1.
- If the student already completed a meaningful action today, do not increase streak again today.
- If the student missed yesterday, reset streak to 1 when they complete a meaningful action today.
- Store:
  - currentStreak
  - longestStreak
  - lastActiveLearningDate
  - hasCompletedLearningToday

Use local storage or the app’s existing user storage system if available.

Suggested data shape:

rewardState = {
  coins: 0,
  xp: 0,
  level: 1,
  currentStreak: 0,
  longestStreak: 0,
  lastActiveLearningDate: null,
  dailyMissions: [],
  earnedBadges: [],
  weeklyStats: {
    weekStartDate: "",
    activeDays: [],
    wordsAdded: 0,
    wordsReviewed: 0,
    quizzesCompleted: 0,
    gamesPlayed: 0,
    mistakesFixed: 0,
    coinsEarned: 0,
    badgesEarned: []
  }
}

Streak badge rewards:
- 3-day streak: Bronze Star
- 7-day streak: Silver Star
- 14-day streak: Gold Star
- 30-day streak: Diamond Badge
- 60-day streak: LexiLand Master
- 100-day streak: Legend of LexiLand

When a streak badge is earned, show a toast or modal:
“Congratulations! You earned the [badge name] badge!”

====================================================
FEATURE 2: DAILY MISSIONS
====================================================

Add a “Today’s Missions” card to the Home page, preferably below the top hero / Snap Textbook area and above Quick Start.

Display 3 missions per day.

Mission pool:
1. Add 3 new words
   - target: 3
   - reward: 20 coins
2. Review 5 flashcards
   - target: 5
   - reward: 20 coins
3. Complete 1 quiz
   - target: 1
   - reward: 30 coins
4. Play 1 vocabulary game
   - target: 1
   - reward: 15 coins
5. Correct 3 mistake words
   - target: 3
   - reward: 30 coins
6. Use Snap Textbook once
   - target: 1
   - reward: 25 coins

Daily mission rules:
- Each day, choose 3 missions.
- Keep the same missions for the whole day.
- Reset missions the next day.
- Each mission has:
  - id
  - title
  - progress
  - target
  - rewardCoins
  - completed
  - claimed
- When a mission target is reached, show it as complete.
- Allow user to tap “Claim” to get coins.
- If all 3 daily missions are completed and claimed, award a Daily Hero Bonus:
  - +50 coins
- Daily Hero Bonus can only be awarded once per day.
- Show a progress indicator such as:
  “2 / 3 missions completed”
- Show mission cards with checkboxes or progress bars.

Suggested UI text:

Today’s Missions
Complete learning missions to keep your streak alive!

□ Review 5 words        0/5    +20 coins
□ Complete 1 quiz       0/1    +30 coins
□ Fix 3 mistakes        0/3    +30 coins

Complete all missions: +50 bonus

====================================================
FEATURE 3: COINS
====================================================

Implement LexiCoins.

Coin earning rules:
- Add 1 word: +3 coins
- Review 1 word: +2 coins
- Correct quiz answer: +2 coins
- Finish quiz: +20 coins
- Play a game: +10 coins
- Fix a mistake word: +5 coins
- Claim daily mission: mission-specific reward
- Complete all daily missions: +50 bonus

Important:
- Avoid double-counting the same action if the same event fires multiple times.
- Create a centralized reward function, for example:
  awardLearningAction(actionType, payload)
- This function should:
  1. Update coins
  2. Update XP if implemented
  3. Update daily mission progress
  4. Update weekly stats
  5. Update streak if this is the first meaningful learning action today
  6. Check and award badges
  7. Show toast feedback

Coin display:
- Add LexiCoins display to the Home page top stats area.
- Example:
  LexiCoins
  120
  🪙

Toast examples:
- “+3 coins! Word added.”
- “+20 coins! Quiz completed.”
- “Daily mission complete! Claim your reward.”
- “Daily Hero Bonus earned! +50 coins.”

====================================================
FEATURE 4: BADGES
====================================================

Implement badges.

Badge data shape:

badges = [
  {
    id: "first_snap",
    name: "First Snap",
    description: "Use Photo Add for the first time.",
    icon: "📸",
    condition: "photo_add_count >= 1"
  },
  {
    id: "word_collector_50",
    name: "Word Collector",
    description: "Add 50 words.",
    icon: "📚",
    condition: "total_words_added >= 50"
  },
  {
    id: "flashcard_starter_20",
    name: "Flashcard Starter",
    description: "Review 20 flashcards.",
    icon: "🃏",
    condition: "total_words_reviewed >= 20"
  },
  {
    id: "quiz_rookie_5",
    name: "Quiz Rookie",
    description: "Complete 5 quizzes.",
    icon: "🏆",
    condition: "total_quizzes_completed >= 5"
  },
  {
    id: "mistake_fixer_30",
    name: "Mistake Fixer",
    description: "Correct 30 mistake words.",
    icon: "🛠️",
    condition: "total_mistakes_fixed >= 30"
  },
  {
    id: "streak_7",
    name: "7-Day Learner",
    description: "Keep a 7-day streak.",
    icon: "🔥",
    condition: "currentStreak >= 7"
  },
  {
    id: "streak_30",
    name: "30-Day Hero",
    description: "Keep a 30-day streak.",
    icon: "💎",
    condition: "currentStreak >= 30"
  },
  {
    id: "dictation_ready",
    name: "Dictation Ready",
    description: "Review all due words and score at least 80% in a quiz.",
    icon: "✅",
    condition: "dueWords === 0 && latestQuizScore >= 80"
  }
]

Badge rules:
- Each badge can only be earned once.
- When earned:
  - Add to earnedBadges
  - Show toast or modal
  - Add it to weeklyStats.badgesEarned
- Add a small “Badges” section on Home or Records page.
- Show earned badges clearly.
- Show locked badges in grey.

====================================================
FEATURE 5: WEEKLY PARENT / TEACHER REPORT
====================================================

Enhance the existing Learning Progress / Records section.

Add a weekly report card with:

- Active days this week
- Current streak
- Longest streak
- Words added this week
- Words reviewed this week
- Quizzes completed this week
- Games played this week
- Mistakes fixed this week
- Coins earned this week
- Badges earned this week
- Suggested focus:
  - If mistakesFixed is low and mistakes > 0:
    “Try fixing mistake words this week.”
  - If wordsReviewed is low:
    “Try reviewing at least 5 words every day.”
  - If activeDays < 5:
    “Try learning on 5 days this week.”
  - If quiz accuracy is available and below 80:
    “Review flashcards before taking the quiz again.”
  - Otherwise:
    “Great work! Keep your streak going.”

Example UI text:

Weekly Summary for Parents & Teachers

Excellent! You studied English 5 days this week.

Active Days: 5
Words Added: 24
Words Reviewed: 42
Quizzes Completed: 4
Games Played: 3
Mistakes Fixed: 12
Coins Earned: 260
Badges Earned: Flashcard Starter, 7-Day Learner

Teacher Tip:
Great progress! Keep reviewing 5 words every day to protect your streak.

====================================================
EVENT HOOKS
====================================================

Please connect the reward system to the existing app events.

When user adds a word manually:
- actionType: "add_word"
- award +3 coins
- increment word-added mission
- increment weeklyStats.wordsAdded

When user uses Photo Add / Snap Textbook successfully:
- actionType: "photo_add"
- award meaningful learning action
- increment snap mission
- check First Snap badge

When AI extracts and saves multiple words from photo:
- for each saved word, count as add_word
- but make sure photo_add itself is counted only once

When user reviews a flashcard:
- actionType: "review_word"
- award +2 coins
- increment review mission
- increment weeklyStats.wordsReviewed

When user completes quiz:
- actionType: "complete_quiz"
- award +20 coins
- increment quiz mission
- increment weeklyStats.quizzesCompleted
- store latestQuizScore
- check Dictation Ready badge if dueWords is 0 and score >= 80

When user answers quiz correctly:
- actionType: "correct_quiz_answer"
- award +2 coins

When user plays a game:
- actionType: "play_game"
- award +10 coins
- increment game mission
- increment weeklyStats.gamesPlayed

When user fixes a mistake word:
- actionType: "fix_mistake"
- award +5 coins
- increment mistake mission
- increment weeklyStats.mistakesFixed

====================================================
FILES / ARCHITECTURE
====================================================

Please inspect the project structure first, then implement in the best fitting style.

If this is a React / Next.js app, prefer:

- src/lib/rewards.ts
  - reward constants
  - badge definitions
  - mission definitions
  - helper functions
- src/hooks/useRewards.ts
  - state handling
  - local storage sync
  - awardLearningAction()
  - claimMissionReward()
  - checkBadges()
- src/components/rewards/TodayMissions.tsx
- src/components/rewards/CoinsStatCard.tsx
- src/components/rewards/BadgesPanel.tsx
- src/components/rewards/WeeklyRewardReport.tsx

If the app uses a different structure, adapt to it.

State persistence:
- Use the existing auth/cloud sync system if easy.
- Otherwise use localStorage first.
- Keep code ready for future cloud sync.

====================================================
DATE HANDLING
====================================================

Use local date string in YYYY-MM-DD format.

Helper functions needed:
- getTodayKey()
- getYesterdayKey()
- isSameDay()
- isYesterday()
- getWeekStartDate()

Weekly stats:
- Start week on Monday.
- If current weekStartDate differs from saved one:
  - reset weeklyStats
  - keep all-time totals and badges.

====================================================
ALL-TIME STATS
====================================================

Please store all-time stats for badges:

allTimeStats = {
  totalWordsAdded: 0,
  totalWordsReviewed: 0,
  totalQuizzesCompleted: 0,
  totalGamesPlayed: 0,
  totalMistakesFixed: 0,
  totalPhotoAdds: 0,
  latestQuizScore: null
}

====================================================
UX REQUIREMENTS
====================================================

- Use the existing app visual style: playful, colourful, student-friendly.
- Use simple language suitable for primary / junior secondary students.
- Add icons:
  - Coins: 🪙
  - Streak: 🔥
  - Missions: ✨
  - Badges: 🏅
- UI should work on mobile.
- Avoid making the home page too crowded.
- Use collapsible sections if needed.
- Add friendly microcopy:
  - “Complete one learning task today to protect your streak.”
  - “Great job! Your streak is safe today.”
  - “Claim your mission reward!”
  - “Fixing mistakes makes your English stronger.”

====================================================
ACCEPTANCE CRITERIA
====================================================

1. Home page shows LexiCoins.
2. Home page shows Today’s Missions with 3 missions.
3. Completing relevant learning actions updates mission progress.
4. Mission rewards can be claimed.
5. Completing all 3 missions awards +50 coins once.
6. Daily streak increases only after meaningful learning action.
7. Daily streak does not increase multiple times in the same day.
8. Missing a day resets the streak to 1 on the next learning action.
9. Badges are awarded once only.
10. Badge unlock feedback appears.
11. Weekly report displays reward-related progress.
12. Rewards persist after page refresh.
13. Existing learning features still work.
14. Code is clean, typed if TypeScript is used, and easy to extend.
15. No duplicate coin rewards from repeated event firing.

====================================================
TEST CASES
====================================================

Please create or manually verify these cases:

Test 1:
- New user opens app.
- Streak remains 0.
- Coins remain 0.

Test 2:
- New user adds 1 word.
- Coins +3.
- Streak becomes 1.
- Add-word mission progress increases.

Test 3:
- User adds more words on same day.
- Coins increase.
- Streak remains 1.

Test 4:
- User completes 3 mission targets.
- All missions completed.
- User claims rewards.
- User gets Daily Hero Bonus once only.

Test 5:
- Simulate next day.
- User reviews flashcards.
- Streak increases from 1 to 2.

Test 6:
- Simulate missing one day.
- User completes learning action.
- Streak resets to 1.

Test 7:
- User uses Photo Add first time.
- First Snap badge unlocks.

Test 8:
- User completes quiz with score 80+ and no due words.
- Dictation Ready badge unlocks.

Test 9:
- Refresh page.
- Coins, streak, missions, badges, weekly stats are still saved.

Test 10:
- Weekly report shows correct weekly numbers.

Please implement this carefully and keep the existing UI working.