import { getAdminServiceClient, sendJson } from "../_admin-supabase.js";
import { runEveningReminderJob } from "../../lib/eveningReminderJob.js";

function verifyCronSecret(request) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const authorization = String(
    request.headers?.authorization || request.headers?.Authorization || "",
  ).trim();

  return authorization === `Bearer ${secret}`;
}

export default async function cronEveningReminders(request, response) {
  if (request.method !== "GET" && request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  if (!verifyCronSecret(request)) {
    sendJson(response, 401, { error: "Unauthorized cron request." });
    return;
  }

  const dryRun = String(request.query?.dryRun || "").trim() === "1";

  try {
    const adminClient = getAdminServiceClient();
    const result = await runEveningReminderJob(adminClient, { dryRun });

    sendJson(response, result.ok ? 200 : 500, result);
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      error: error.message || "Evening reminder job failed.",
    });
  }
}
