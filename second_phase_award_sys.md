You are helping me implement the “Add Later Phase” reward features for my app “LexiLand”.

The Must-Have Phase reward system may already exist with:
- Daily Streak
- Today’s Missions
- LexiCoins
- Badges
- Weekly Parent / Teacher Report
- Central function such as awardLearningAction()
- Reward state persisted in localStorage or existing user/cloud storage

Now implement the Add Later Phase:

1. Avatar Shop
2. Team Challenge
3. Class Leaderboard
4. Mystery Chest
5. Seasonal Events

Important design principle:
These features should encourage daily learning, cooperation, and healthy competition. They should NOT punish weaker students. Avoid leaderboards that only reward already-strong students.

====================================================
GENERAL REQUIREMENTS
====================================================

Please inspect the existing project structure first.

If this is a React / Next.js app, prefer this structure:

- src/lib/rewardExtensions.ts
  - avatar shop item definitions
  - team definitions
  - leaderboard category definitions
  - mystery chest definitions
  - seasonal event definitions

- src/hooks/useRewardExtensions.ts
  - avatar purchase/equip logic
  - team challenge logic
  - leaderboard logic
  - mystery chest opening logic
  - seasonal event progress logic

- src/components/rewards/AvatarShop.tsx
- src/components/rewards/TeamChallenge.tsx
- src/components/rewards/ClassLeaderboard.tsx
- src/components/rewards/MysteryChest.tsx
- src/components/rewards/SeasonalEvents.tsx
- src/components/rewards/RewardCenter.tsx

If the app uses a different structure, adapt to it.

Add a new “Reward Center” page or section accessible from:
- Home page
- Menu
- Records / Learning Progress

Suggested menu label:
“Rewards”

Suggested icon:
🎁

Reward Center tabs:
1. Avatar
2. Team
3. Leaderboard
4. Chests
5. Events

Use existing visual style:
- Playful
- Colourful
- Mobile-friendly
- Simple English suitable for primary / junior secondary students

====================================================
STATE SHAPE
====================================================

Extend existing rewardState.

Suggested shape:

rewardState = {
  ...existingRewardState,

  avatar: {
    selectedAvatarId: "lexi_monster_blue",
    selectedFrameId: null,
    selectedBackgroundId: null,
    selectedAccessoryIds: [],
    ownedItemIds: ["lexi_monster_blue"]
  },

  team: {
    teamId: null,
    joinedAt: null,
    currentWeekTeamPoints: 0,
    lifetimeTeamPoints: 0
  },

  leaderboard: {
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
      teamPoints: 0
    }
  },

  mysteryChests: {
    availableChestIds: [],
    openedChestHistory: [],
    lastFreeChestDate: null
  },

  seasonalEvents: {
    activeEventId: null,
    eventProgress: {},
    claimedMilestoneIds: []
  }
}

If user accounts / classes / cloud sync already exist, use them.
If not, implement local-only mode first and keep code ready for cloud sync later.

====================================================
FEATURE 1: AVATAR SHOP
====================================================

Implement an Avatar Shop where students can spend LexiCoins on cosmetic items.

Important:
- Items are cosmetic only.
- Do not allow students to buy learning progress, quiz scores, streaks, or badges.

Shop categories:
1. Avatars
2. Hats / Accessories
3. Badge Frames
4. Background Themes
5. Game Effects

Add starter item:
- Blue Lexi Monster
- id: "lexi_monster_blue"
- price: 0
- owned by default

Suggested shop items:

Avatars:
- Blue Lexi Monster
  - id: "lexi_monster_blue"
  - price: 0
  - icon: 🐉
- Green Lexi Monster
  - id: "lexi_monster_green"
  - price: 150
  - icon: 🟢
- Pink Lexi Monster
  - id: "lexi_monster_pink"
  - price: 150
  - icon: 🌸
- Golden Lexi Monster
  - id: "lexi_monster_gold"
  - price: 500
  - icon: ⭐

Accessories:
- Wizard Hat
  - id: "wizard_hat"
  - price: 120
  - icon: 🧙
- Ninja Headband
  - id: "ninja_headband"
  - price: 120
  - icon: 🥷
- Crown
  - id: "crown"
  - price: 300
  - icon: 👑
- Smart Glasses
  - id: "smart_glasses"
  - price: 100
  - icon: 🤓

Badge Frames:
- Rainbow Frame
  - id: "rainbow_frame"
  - price: 200
  - icon: 🌈
- Fire Frame
  - id: "fire_frame"
  - price: 250
  - icon: 🔥
- Diamond Frame
  - id: "diamond_frame"
  - price: 400
  - icon: 💎

Background Themes:
- Ocean Theme
  - id: "ocean_theme"
  - price: 180
  - icon: 🌊
- Space Theme
  - id: "space_theme"
  - price: 220
  - icon: 🚀
- Candy Theme
  - id: "candy_theme"
  - price: 180
  - icon: 🍬

Game Effects:
- Sparkle Effect
  - id: "sparkle_effect"
  - price: 160
  - icon: ✨
- Fire Trail Effect
  - id: "fire_trail_effect"
  - price: 220
  - icon: 🔥
- Bubble Effect
  - id: "bubble_effect"
  - price: 160
  - icon: 🫧

Avatar Shop rules:
- Show current LexiCoins balance.
- Show items as cards.
- If not owned:
  - button: “Buy”
  - disabled if not enough coins
- If owned:
  - button: “Equip”
- If equipped:
  - show “Equipped”
- Deduct coins when buying.
- Add item id to ownedItemIds.
- Allow equipping purchased items.
- Prevent duplicate purchases.
- Show toast:
  - “Bought Green Lexi Monster!”
  - “Not enough coins yet. Complete missions to earn more!”
  - “Equipped Wizard Hat!”

Add a small avatar preview on Home page:
- Show selected avatar
- Show selected accessory
- Show selected frame/background if applicable
- Button: “Customize”

====================================================
FEATURE 2: TEAM CHALLENGE
====================================================

Implement weekly team challenges.

Teams:
1. Blue Dragon
   - id: "blue_dragon"
   - color: blue
   - icon: 🐉
2. Red Phoenix
   - id: "red_phoenix"
   - color: red
   - icon: 🔥
3. Green Turtle
   - id: "green_turtle"
   - color: green
   - icon: 🐢
4. Golden Tiger
   - id: "golden_tiger"
   - color: yellow
   - icon: 🐯

Team join rules:
- Student can choose a team.
- If there is no class backend yet, store locally.
- Allow changing team only once per week to avoid abuse.
- If user has not joined a team, show:
  “Join a team and learn together!”
- Team challenges reset every Monday.

Team points:
Award team points when students complete learning actions.

Suggested team point rules:
- Add 1 word: +1 team point
- Review 1 word: +1 team point
- Complete 1 quiz: +10 team points
- Play 1 game: +5 team points
- Fix 1 mistake: +3 team points
- Complete all daily missions: +20 team points
- Keep streak safe today: +5 team points

Connect this to the existing reward system.
When awardLearningAction() is called, also update team points if a team is joined.

Team Challenge UI:
- Show student’s team
- Show weekly team points
- Show team progress bar
- Show team challenge goal

Weekly team challenge examples:
- “Review 500 words together”
- “Fix 100 mistakes together”
- “Complete 100 quizzes together”
- “Study on 5 days this week”

If no backend exists, show a local/demo version:
- “Class team totals need teacher sync. Your personal team points are saved on this device.”
- Still implement personal team points.

Weekly team reward:
If student contributes at least 50 team points this week:
- Award “Team Helper” badge or title
- Give +100 coins at weekly reset or when challenge is completed
- Only once per week

Friendly text:
- “Every word helps your team!”
- “Team points reward effort, not just high scores.”

====================================================
FEATURE 3: CLASS LEADERBOARD
====================================================

Implement a healthy weekly class leaderboard.

Important:
Do not create only one total-score leaderboard.
Use multiple categories so different students can win.

Leaderboard categories:
1. Most Improved
2. Longest Streak
3. Most Mistakes Fixed
4. Most Words Reviewed
5. Quiz Accuracy
6. Team Helper Points

Suggested leaderboard data shape:

leaderboardEntry = {
  userId: "",
  displayName: "",
  avatar: {},
  teamId: "",
  scores: {
    improvementScore: 0,
    currentStreak: 0,
    mistakesFixed: 0,
    wordsReviewed: 0,
    quizAccuracy: 0,
    teamPoints: 0
  }
}

Privacy rules:
- Student must opt in before appearing on leaderboard.
- If not opted in, show:
  “Join the leaderboard with a nickname.”
- Use displayName / nickname, not full legal name.
- Add anonymousId for local mode.
- If backend/class system exists, use classCode.
- If no backend exists, show local/demo leaderboard with only current student and sample hidden rows disabled by default.

Weekly reset:
- Leaderboard should reset every Monday.
- Keep historical weekly summaries if easy.

Leaderboard UI:
- Tabs or dropdown for categories:
  - Improved
  - Streak
  - Mistakes Fixed
  - Words Reviewed
  - Quiz Accuracy
  - Team Points
- Show top 10.
- Highlight current student.
- Show rank if available.
- Show encouraging copy:
  “Leaderboards reset every week, so everyone gets a fresh start.”
  “Mistake Fixer rewards effort and growth.”

Scoring details:
- Most Improved:
  - improvementScore can be calculated as:
    previousWeekAccuracy to currentWeekAccuracy improvement
    plus increase in words reviewed
    plus mistakes fixed
  - If not enough historical data, use:
    mistakesFixed * 3 + wordsReviewed + missionsCompleted * 5
- Quiz Accuracy:
  - Only show if student completed at least 2 quizzes this week.
  - Otherwise show “Need 2 quizzes to join this category.”
- Longest Streak:
  - Use currentStreak.
- Most Mistakes Fixed:
  - Use weekly mistakesFixed.
- Most Words Reviewed:
  - Use weekly wordsReviewed.
- Team Helper Points:
  - Use weekly team points.

====================================================
FEATURE 4: MYSTERY CHEST
====================================================

Implement Mystery Chest rewards.

Chest types:
1. Daily Chest
2. Mission Chest
3. Streak Chest
4. Event Chest

Daily Chest:
- Available once per day after the student completes one meaningful learning action.
- Must not be available just for opening app.
- Reward examples:
  - 10–30 coins
  - small chance of cosmetic item
  - small XP bonus if XP exists

Mission Chest:
- Available after completing all 3 daily missions.
- Reward examples:
  - 30–80 coins
  - higher chance of cosmetic item

Streak Chest:
- Available on streak milestones:
  - 7 days
  - 14 days
  - 30 days
  - 60 days
  - 100 days
- Reward examples:
  - 100–500 coins
  - exclusive frame / background

Event Chest:
- Awarded from seasonal events.

Suggested chest data:

chestDefinitions = [
  {
    id: "daily_chest",
    name: "Daily Chest",
    icon: "🎁",
    description: "Complete one learning task today to open.",
    rewardTable: [
      { type: "coins", min: 10, max: 30, weight: 90 },
      { type: "cosmetic", itemPool: "common", weight: 10 }
    ]
  },
  {
    id: "mission_chest",
    name: "Mission Chest",
    icon: "⭐",
    description: "Complete all daily missions to open.",
    rewardTable: [
      { type: "coins", min: 30, max: 80, weight: 80 },
      { type: "cosmetic", itemPool: "common", weight: 15 },
      { type: "cosmetic", itemPool: "rare", weight: 5 }
    ]
  }
]

Mystery Chest rules:
- Chests can only be opened when unlocked.
- Each chest opening should generate one reward.
- Prevent duplicate item rewards:
  - If cosmetic item already owned, convert to coins.
  - common duplicate: +50 coins
  - rare duplicate: +120 coins
  - exclusive duplicate: +250 coins
- Save openedChestHistory:
  - chestId
  - date
  - reward
- Show chest opening animation if simple to implement.
- Show result modal:
  “You found 25 coins!”
  “You found Rainbow Frame!”
  “Duplicate item converted to 50 coins.”

Unlock logic:
- Daily chest unlocks when hasCompletedLearningToday is true and lastFreeChestDate is not today.
- Mission chest unlocks when all daily missions completed.
- Streak chest unlocks at milestone streaks and can be opened once per milestone.
- Event chest unlocks when event milestone says so.

====================================================
FEATURE 5: SEASONAL EVENTS
====================================================

Implement a basic Seasonal Events system.

Events should be configurable and date-based.

Example seasonal events:

1. Summer Vocabulary Quest
   - id: "summer_vocab_quest"
   - dates: June 1 to August 31
   - theme: ☀️
   - goal:
     - Review 100 words during the event
   - milestones:
     - 25 words reviewed: +50 coins
     - 50 words reviewed: Summer Badge
     - 100 words reviewed: Summer Background

2. Back to School Challenge
   - id: "back_to_school"
   - dates: September 1 to September 30
   - theme: 🎒
   - goal:
     - Add 50 textbook words
   - milestones:
     - 10 words added: +30 coins
     - 25 words added: School Star badge
     - 50 words added: Pencil Crown accessory

3. Halloween Word Hunt
   - id: "halloween_word_hunt"
   - dates: October 1 to October 31
   - theme: 🎃
   - goal:
     - Fix 50 mistake words
   - milestones:
     - 10 mistakes fixed: +30 coins
     - 25 mistakes fixed: Pumpkin Frame
     - 50 mistakes fixed: Halloween Chest

4. Winter Review Festival
   - id: "winter_review_festival"
   - dates: December 1 to December 31
   - theme: ❄️
   - goal:
     - Complete 20 quizzes
   - milestones:
     - 5 quizzes: +50 coins
     - 10 quizzes: Snow Badge
     - 20 quizzes: Snow Background

Seasonal Event rules:
- Detect active event based on current date.
- Show active event card on Reward Center and optionally Home page.
- If no active event:
  - Show “No event right now. Keep learning to earn coins!”
- Track event progress based on learning actions.
- Milestone rewards can only be claimed once.
- Seasonal rewards should include:
  - coins
  - badges/titles
  - exclusive cosmetic items
  - event chests
- If event ends:
  - Hide claim buttons for unearned milestones
  - Keep earned items
  - Show previous event summary if easy

Event UI:
- Event name
- Event dates
- Event goal
- Progress bar
- Milestones
- Claim buttons
- Event reward preview

Example UI text:
“Summer Vocabulary Quest ☀️”
“Review 100 words before August 31.”
“Progress: 42 / 100 words”
“Next reward: Summer Badge at 50 words”

====================================================
INTEGRATION WITH EXISTING REWARDS
====================================================

Extend the existing centralized reward function.

If existing function is:

awardLearningAction(actionType, payload)

Then update it so the following systems receive progress:

- Avatar shop:
  - no direct progress needed, but uses coins and owned items

- Team challenge:
  - add team points based on action type

- Leaderboard:
  - update weekly category scores

- Mystery chest:
  - unlock daily chest after first meaningful learning action
  - unlock mission chest after all daily missions completed
  - unlock streak chest at milestones

- Seasonal events:
  - update event progress based on action type

Action mapping:

add_word:
- team points +1
- leaderboard.wordsReviewed unaffected
- event progress if event goal is wordsAdded
- shop no direct effect

review_word:
- team points +1
- leaderboard.wordsReviewed +1
- event progress if event goal is wordsReviewed

complete_quiz:
- team points +10
- update quiz count
- update quiz accuracy if score exists
- event progress if event goal is quizzesCompleted

play_game:
- team points +5
- event progress if event goal is gamesPlayed

fix_mistake:
- team points +3
- leaderboard.mistakesFixed +1
- event progress if event goal is mistakesFixed

daily_hero_bonus:
- team points +20
- leaderboard.missionsCompleted +1
- unlock mission chest

streak_safe_today:
- team points +5
- unlock daily chest
- possibly unlock streak chest

====================================================
REWARD CENTER PAGE
====================================================

Create a Reward Center page or component.

Sections / tabs:

1. Avatar Shop
- Avatar preview
- Coin balance
- Shop item cards
- Owned/equipped status

2. Team Challenge
- Join team
- Your team
- Weekly team points
- Team challenge progress
- Team contribution reward

3. Class Leaderboard
- Opt-in nickname
- Class code if available
- Category tabs
- Top 10 list
- Current student highlight

4. Mystery Chests
- Available chests
- Locked chests
- Open button
- Chest history

5. Seasonal Events
- Active event card
- Progress bar
- Milestone rewards
- Claim buttons

Add Reward Center entry points:
- Home Quick Start card:
  “Rewards”
  “Customize avatar, open chests, join team”
- Bottom menu if applicable
- Records page link

====================================================
UX COPY
====================================================

Use friendly copy:

Reward Center:
“Earn coins, open chests, and customize your LexiLand hero!”

Avatar Shop:
“Spend coins on fun looks. Learning progress cannot be bought.”

Team Challenge:
“Join a team. Every word helps!”

Leaderboard:
“Weekly leaderboards reset every Monday. Everyone gets a fresh start.”

Mystery Chest:
“Complete learning tasks to unlock surprise rewards.”

Seasonal Events:
“Special challenges appear during the year. Earn limited rewards!”

Not enough coins:
“Not enough coins yet. Complete missions to earn more!”

Privacy:
“Use a nickname. Do not use your full real name.”

====================================================
PERSISTENCE
====================================================

Persist all new state:
- avatar purchases/equips
- team selection
- weekly team points
- leaderboard opt-in/nickname/classCode
- mystery chest availability/history
- seasonal event progress/claimed milestones

Use existing storage if possible.
If not, use localStorage.

LocalStorage key suggestion:
lexiland_reward_extensions_v1

If Must-Have reward state already uses a key, either:
- extend the same key safely, or
- create a second key and merge in hooks.

Add migration/default initialization so old users do not break.

====================================================
WEEKLY RESET
====================================================

On Monday reset:
- team.currentWeekTeamPoints
- leaderboard.weeklyScores
- weekly challenge contribution reward status

Do not reset:
- coins
- owned avatar items
- equipped avatar
- lifetime team points
- badges
- chest history
- seasonal claimed milestones for still-active event

Keep current streak logic unchanged.

====================================================
DATE HANDLING
====================================================

Use local date string in YYYY-MM-DD format.

Helper functions:
- getTodayKey()
- getWeekStartDate()
- isNewWeek()
- isEventActive(event, today)
- hasOpenedChestToday(chestId)
- hasClaimedEventMilestone(eventId, milestoneId)

Week starts on Monday.

====================================================
EDGE CASES
====================================================

Handle these carefully:

1. User has not joined a team:
- Do not award team points.
- Show join team prompt.

2. User buys item but app refreshes:
- Item remains owned.
- Coins remain deducted.

3. User tries to buy same item twice:
- Prevent duplicate purchase.

4. User does not have enough coins:
- Disable buy button.
- Show friendly message.

5. User already opened daily chest:
- Disable open button until next day.

6. User earns duplicate chest cosmetic:
- Convert to coins.

7. Seasonal event ended:
- Do not allow claiming unearned milestones.
- Keep earned rewards.

8. No class backend:
- Leaderboard should work in local/demo mode without breaking.
- Clearly show that class sync requires teacher setup.

9. Leaderboard privacy:
- Do not show student on leaderboard unless optIn is true.
- Use nickname only.

10. Repeated event firing:
- Prevent duplicate chest unlocks, milestone claims, and team contribution rewards.

====================================================
ACCEPTANCE CRITERIA
====================================================

Avatar Shop:
1. Reward Center shows Avatar Shop.
2. Student can buy an item with coins.
3. Coins are deducted correctly.
4. Owned item can be equipped.
5. Equipped avatar appears in preview.
6. Duplicate purchase is blocked.
7. Not enough coins disables purchase.

Team Challenge:
8. Student can join one of four teams.
9. Learning actions add weekly team points.
10. Team points reset weekly.
11. Lifetime team points remain.
12. If no backend exists, local mode still works.

Class Leaderboard:
13. Student can opt in with nickname.
14. Leaderboard has multiple categories.
15. Leaderboard resets weekly.
16. Current student is highlighted.
17. Quiz Accuracy requires at least 2 quizzes.
18. Privacy copy is shown.

Mystery Chest:
19. Daily chest unlocks only after meaningful learning action.
20. Daily chest can open once per day.
21. Mission chest unlocks after all daily missions.
22. Streak chest unlocks at streak milestones.
23. Chest reward is saved in history.
24. Duplicate cosmetic converts to coins.

Seasonal Events:
25. Active event is detected by date.
26. Event progress updates from learning actions.
27. Milestone rewards can be claimed once.
28. Earned event cosmetics/badges persist.
29. Ended events do not allow new unearned claims.

General:
30. Reward Center is accessible from Home/Menu.
31. All new state persists after refresh.
32. Existing Must-Have rewards still work.
33. Existing app features still work.
34. UI is mobile-friendly.
35. Code is clean and easy to extend.

====================================================
TEST CASES
====================================================

Please implement and/or manually verify:

Test 1: Avatar purchase
- Give user 200 coins.
- Buy Green Lexi Monster for 150.
- Coins become 50.
- Item appears owned.
- Equip button works.

Test 2: Not enough coins
- User has 50 coins.
- Wizard Hat costs 120.
- Buy button disabled.
- Friendly message appears.

Test 3: Duplicate purchase
- User owns Green Lexi Monster.
- Buying again is impossible.

Test 4: Team join
- User joins Blue Dragon.
- Team id persists after refresh.

Test 5: Team points
- User reviews 3 words.
- Weekly team points increase by 3.
- Lifetime team points increase by 3.

Test 6: Weekly reset
- Simulate next Monday.
- Weekly team points reset.
- Lifetime team points remain.

Test 7: Leaderboard opt-in
- User enters nickname.
- User opts in.
- User appears in local leaderboard.

Test 8: Leaderboard privacy
- User opts out.
- User does not appear.

Test 9: Daily chest
- User opens app.
- Daily chest locked.
- User completes one meaningful learning action.
- Daily chest unlocks.
- User opens it once.
- Second open same day is blocked.

Test 10: Mission chest
- User completes and claims all daily missions.
- Mission chest unlocks.
- Opening chest gives reward and saves history.

Test 11: Streak chest
- Simulate 7-day streak.
- 7-day streak chest unlocks.
- Open once only.

Test 12: Duplicate cosmetic chest reward
- User already owns Rainbow Frame.
- Chest gives Rainbow Frame again.
- Reward converts to coins.

Test 13: Seasonal event progress
- Set date inside Summer Vocabulary Quest.
- Review words.
- Event progress increases.

Test 14: Seasonal milestone claim
- Reach 25 reviewed words.
- Claim +50 coins.
- Cannot claim same milestone twice.

Test 15: Event ended
- Set date after event end.
- Unearned milestones cannot be claimed.
- Earned items remain.

Please implement this carefully and keep the existing app stable.