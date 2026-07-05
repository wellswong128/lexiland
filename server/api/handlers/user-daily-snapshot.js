import { sendAuthError } from "../_authz.js";
import {
  createRlsClientForRequest,
  getRequestBody,
  requireUserGroupAccess,
  sendJson,
} from "../_user-groups.js";

function clampCount(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeDateKey(value) {
  const dateKey = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/u.test(dateKey) ? dateKey : "";
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

export default async function userDailySnapshot(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  let auth;

  try {
    auth = await requireUserGroupAccess(request);
  } catch (error) {
    sendAuthError(response, error);
    return;
  }

  let rlsClient;

  try {
    rlsClient = createRlsClientForRequest(request);
  } catch (error) {
    sendJson(response, 401, { error: error.message || "Unauthorized." });
    return;
  }

  const body = getRequestBody(request);
  const dateKey = normalizeDateKey(body.dateKey);

  if (!dateKey) {
    sendJson(response, 400, { error: "dateKey is required (YYYY-MM-DD)." });
    return;
  }

  const snapshot = {
    user_id: auth.user.id,
    date_key: dateKey,
    streak: clampCount(body.streak),
    has_completed_learning_today: Boolean(body.hasCompletedLearningToday),
    daily_tasks_completed: clampCount(body.dailyTasksCompleted),
    daily_tasks_total: clampCount(body.dailyTasksTotal, 3),
    all_daily_tasks_done: Boolean(body.allDailyTasksDone),
    missions_completed: clampCount(body.missionsCompleted),
    missions_total: clampCount(body.missionsTotal),
    streak_safe_today: Boolean(body.streakSafeToday),
    pending_task_labels: normalizeTaskLabels(body.pendingTaskLabels),
  };

  try {
    const { data, error } = await rlsClient
      .from("user_daily_snapshots")
      .upsert(snapshot, { onConflict: "user_id,date_key" })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message || "Failed to save daily snapshot.");
    }

    sendJson(response, 200, { snapshot: data });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Failed to save daily snapshot." });
  }
}
