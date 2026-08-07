export const DEFAULT_REMINDER_TIMEZONE = "Asia/Hong_Kong";

export function normalizeReminderTimezone(value) {
  const timezone = String(value || "").trim();
  if (!timezone) {
    return DEFAULT_REMINDER_TIMEZONE;
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return timezone;
  } catch {
    return DEFAULT_REMINDER_TIMEZONE;
  }
}

export function getReminderLocalDateParts(timezone, now = new Date()) {
  const safeTimezone = normalizeReminderTimezone(timezone);
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
}
