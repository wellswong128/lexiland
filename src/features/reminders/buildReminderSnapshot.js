import { getDailyMissionSummary } from "../rewards/rewardsEngine.js";
import { loadRewardState } from "../rewards/rewardsStore.js";
import { getDailyTasks, getLocalDateKey, getLearningSnapshot } from "../../lib/learningActivity.js";

export function buildReminderSnapshot(words, locale = "zh-HK") {
  const learningSnapshot = getLearningSnapshot(words);
  const rewardState = loadRewardState();
  const missionSummary = getDailyMissionSummary(rewardState);
  const missions = rewardState.dailyState?.missions ?? [];
  const pendingTaskLabels = learningSnapshot.dailyTasks.tasks
    .filter((task) => !task.done)
    .map((task) => task.id);

  return {
    dateKey: getLocalDateKey(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Hong_Kong",
    locale,
    streak: learningSnapshot.streak,
    hasCompletedLearningToday: missionSummary.streakSafeToday,
    dailyTasksCompleted: learningSnapshot.dailyTasks.completedCount,
    dailyTasksTotal: learningSnapshot.dailyTasks.totalCount,
    allDailyTasksDone: learningSnapshot.dailyTasks.allDone,
    missionsCompleted: missions.filter((mission) => mission.completed).length,
    missionsTotal: missions.length,
    streakSafeToday: missionSummary.streakSafeToday,
    pendingTaskLabels,
  };
}
