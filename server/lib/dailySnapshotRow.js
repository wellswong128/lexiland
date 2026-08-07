import {
  getReminderLocalDateParts,
  normalizeReminderTimezone,
} from "./reminderTime.js";

function clampCount(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeDateKey(value) {
  const dateKey = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/u.test(dateKey) ? dateKey : "";
}

function normalizeLocale(value) {
  const locale = String(value || "").trim();
  return locale || "zh-HK";
}

function normalizeTaskLabels(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .slice(0, 10);
}

export function buildDailySnapshotRow(body = {}, userId, now = new Date()) {
  const timezone = normalizeReminderTimezone(body.timezone);
  const { dateKey } = getReminderLocalDateParts(timezone, now);
  const clientDateKey = normalizeDateKey(body.dateKey);
  const resolvedDateKey = dateKey || clientDateKey;

  return {
    settingsPatch: {
      locale: normalizeLocale(body.locale),
      timezone,
    },
    snapshot: {
      user_id: userId,
      date_key: resolvedDateKey,
      streak: clampCount(body.streak),
      has_completed_learning_today: Boolean(body.hasCompletedLearningToday),
      daily_tasks_completed: clampCount(body.dailyTasksCompleted),
      daily_tasks_total: clampCount(body.dailyTasksTotal, 3),
      all_daily_tasks_done: Boolean(body.allDailyTasksDone),
      missions_completed: clampCount(body.missionsCompleted),
      missions_total: clampCount(body.missionsTotal),
      streak_safe_today: Boolean(body.streakSafeToday),
      pending_task_labels: normalizeTaskLabels(body.pendingTaskLabels),
    },
  };
}
