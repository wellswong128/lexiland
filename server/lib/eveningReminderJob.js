import { buildEveningReminderEmail } from "./eveningReminderContent.js";
import { isEmailConfigured, sendEmail } from "./sendEmail.js";

export const EVENING_REMINDER_HOUR = 20;

export function getLocalHourAndDateKey(timezone, now = new Date()) {
  const safeTimezone = String(timezone || "Asia/Hong_Kong").trim() || "Asia/Hong_Kong";

  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: safeTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      hour12: false,
    });
    const parts = Object.fromEntries(
      formatter.formatToParts(now).map((part) => [part.type, part.value]),
    );

    return {
      dateKey: `${parts.year}-${parts.month}-${parts.day}`,
      hour: Number.parseInt(parts.hour, 10),
      timezone: safeTimezone,
    };
  } catch {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Hong_Kong",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      hour12: false,
    });
    const parts = Object.fromEntries(
      formatter.formatToParts(now).map((part) => [part.type, part.value]),
    );

    return {
      dateKey: `${parts.year}-${parts.month}-${parts.day}`,
      hour: Number.parseInt(parts.hour, 10),
      timezone: "Asia/Hong_Kong",
    };
  }
}

function normalizeDateKey(value) {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 10);
}

function userNeedsReminder(snapshot) {
  if (!snapshot) {
    return true;
  }

  if (!snapshot.all_daily_tasks_done) {
    return true;
  }

  return !snapshot.streak_safe_today;
}

export async function runEveningReminderJob(adminClient, { now = new Date(), dryRun = false } = {}) {
  if (!isEmailConfigured()) {
    return {
      ok: false,
      error: "Email is not configured. Set CLOUDFLARE_API_TOKEN and redeploy.",
      sent: 0,
      skipped: 0,
      candidates: 0,
    };
  }

  const { data: settingsRows, error: settingsError } = await adminClient
    .from("user_reminder_settings")
    .select("user_id,timezone,locale,last_reminder_sent_date,evening_reminder_enabled")
    .eq("evening_reminder_enabled", true);

  if (settingsError) {
    throw new Error(settingsError.message || "Failed to load reminder settings.");
  }

  const enabledSettings = settingsRows ?? [];
  let sent = 0;
  let skipped = 0;
  let candidates = 0;
  const errors = [];

  for (const settings of enabledSettings) {
    const { dateKey, hour } = getLocalHourAndDateKey(settings.timezone, now);

    if (hour !== EVENING_REMINDER_HOUR) {
      skipped += 1;
      continue;
    }

    if (normalizeDateKey(settings.last_reminder_sent_date) === dateKey) {
      skipped += 1;
      continue;
    }

    const { data: snapshot, error: snapshotError } = await adminClient
      .from("user_daily_snapshots")
      .select("*")
      .eq("user_id", settings.user_id)
      .eq("date_key", dateKey)
      .maybeSingle();

    if (snapshotError) {
      errors.push({ userId: settings.user_id, message: snapshotError.message });
      continue;
    }

    if (!userNeedsReminder(snapshot)) {
      skipped += 1;
      continue;
    }

    candidates += 1;

    const { data: userResult, error: userError } =
      await adminClient.auth.admin.getUserById(settings.user_id);

    if (userError) {
      errors.push({ userId: settings.user_id, message: userError.message });
      continue;
    }

    const email = String(userResult?.user?.email || "").trim();
    if (!email) {
      skipped += 1;
      continue;
    }

    const emailContent = buildEveningReminderEmail({
      locale: settings.locale,
      streak: snapshot?.streak ?? 0,
      pendingTaskLabels: snapshot?.pending_task_labels ?? [],
      dailyTasksCompleted: snapshot?.daily_tasks_completed ?? 0,
      dailyTasksTotal: snapshot?.daily_tasks_total ?? 3,
      hasSnapshot: Boolean(snapshot),
    });

    if (dryRun) {
      sent += 1;
      continue;
    }

    try {
      await sendEmail({
        to: email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      const { error: updateError } = await adminClient
        .from("user_reminder_settings")
        .update({ last_reminder_sent_date: dateKey })
        .eq("user_id", settings.user_id);

      if (updateError) {
        errors.push({ userId: settings.user_id, message: updateError.message });
        continue;
      }

      sent += 1;
    } catch (error) {
      errors.push({
        userId: settings.user_id,
        message: error?.message || "Failed to send reminder email.",
      });
    }
  }

  return {
    ok: errors.length === 0,
    sent,
    skipped,
    candidates,
    checked: enabledSettings.length,
    errors,
  };
}
