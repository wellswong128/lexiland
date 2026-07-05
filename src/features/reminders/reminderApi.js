import { getApiAuthHeaders } from "../../lib/apiAuth.js";
import { resolveApiUrl } from "../../lib/apiBase.js";

async function parseJsonResponse(response) {
  let payload = {};

  try {
    payload = await response.json();
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const apiError = typeof payload.error === "string" ? payload.error.trim() : "";
    throw new Error(apiError || `Request failed (${response.status}).`);
  }

  return payload;
}

export async function fetchReminderSettings() {
  const authHeaders = await getApiAuthHeaders();
  const response = await fetch(resolveApiUrl("/api/user-reminder-settings"), {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
  });

  return parseJsonResponse(response);
}

export async function updateReminderSettings({
  eveningReminderEnabled,
  timezone,
  locale,
}) {
  const authHeaders = await getApiAuthHeaders();
  const response = await fetch(resolveApiUrl("/api/user-reminder-settings"), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify({
      eveningReminderEnabled,
      timezone,
      locale,
    }),
  });

  return parseJsonResponse(response);
}

export async function syncDailySnapshot(snapshot) {
  const authHeaders = await getApiAuthHeaders();
  const response = await fetch(resolveApiUrl("/api/user-daily-snapshot"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(snapshot),
  });

  return parseJsonResponse(response);
}
