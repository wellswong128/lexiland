import { sendAuthError } from "../_authz.js";
import {
  createRlsClientForRequest,
  getRequestBody,
  requireUserGroupAccess,
  sendJson,
} from "../_user-groups.js";
import { buildDailySnapshotRow } from "../../lib/dailySnapshotRow.js";

async function refreshReminderSettingsTimezone(rlsClient, userId, settingsPatch) {
  const { error } = await rlsClient
    .from("user_reminder_settings")
    .update(settingsPatch)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message || "Failed to refresh reminder timezone.");
  }
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
  const { settingsPatch, snapshot } = buildDailySnapshotRow(body, auth.user.id);

  if (!snapshot.date_key) {
    sendJson(response, 400, { error: "dateKey is required (YYYY-MM-DD)." });
    return;
  }

  try {
    await refreshReminderSettingsTimezone(rlsClient, auth.user.id, settingsPatch);

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
