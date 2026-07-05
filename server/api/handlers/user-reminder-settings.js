import { sendAuthError } from "../_authz.js";
import {
  createRlsClientForRequest,
  getRequestBody,
  requireUserGroupAccess,
  sendJson,
} from "../_user-groups.js";

const DEFAULT_SETTINGS = {
  evening_reminder_enabled: false,
  timezone: "Asia/Hong_Kong",
  locale: "zh-HK",
  last_reminder_sent_date: null,
};

function normalizeTimezone(value) {
  const timezone = String(value || "").trim();
  if (!timezone) {
    return DEFAULT_SETTINGS.timezone;
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return timezone;
  } catch {
    return DEFAULT_SETTINGS.timezone;
  }
}

function normalizeLocale(value) {
  const locale = String(value || "").trim();
  return locale || DEFAULT_SETTINGS.locale;
}

async function readSettings(rlsClient, userId) {
  const { data, error } = await rlsClient
    .from("user_reminder_settings")
    .select("evening_reminder_enabled,timezone,locale,last_reminder_sent_date,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load reminder settings.");
  }

  return {
    ...DEFAULT_SETTINGS,
    ...(data ?? {}),
  };
}

export default async function userReminderSettings(request, response) {
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

  if (request.method === "GET") {
    try {
      const settings = await readSettings(rlsClient, auth.user.id);
      sendJson(response, 200, { settings });
    } catch (error) {
      sendJson(response, 500, { error: error.message || "Failed to load reminder settings." });
    }

    return;
  }

  if (request.method !== "PATCH" && request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const body = getRequestBody(request);
  const nextSettings = {
    user_id: auth.user.id,
    evening_reminder_enabled: Boolean(body.eveningReminderEnabled),
    timezone: normalizeTimezone(body.timezone),
    locale: normalizeLocale(body.locale),
  };

  try {
    const { data, error } = await rlsClient
      .from("user_reminder_settings")
      .upsert(nextSettings, { onConflict: "user_id" })
      .select("evening_reminder_enabled,timezone,locale,last_reminder_sent_date,updated_at")
      .single();

    if (error) {
      throw new Error(error.message || "Failed to save reminder settings.");
    }

    sendJson(response, 200, {
      settings: {
        ...DEFAULT_SETTINGS,
        ...data,
      },
    });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Failed to save reminder settings." });
  }
}
