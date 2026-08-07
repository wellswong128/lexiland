import assert from "node:assert/strict";
import test from "node:test";

import { buildDailySnapshotRow } from "../server/lib/dailySnapshotRow.js";
import {
  DEFAULT_REMINDER_TIMEZONE,
  getReminderLocalDateParts,
} from "../server/lib/reminderTime.js";

test("daily snapshot date_key is derived from reported reminder timezone", () => {
  const now = new Date("2026-08-07T03:30:00.000Z");
  const { settingsPatch, snapshot } = buildDailySnapshotRow(
    {
      dateKey: "2026-08-06",
      timezone: "Asia/Hong_Kong",
      locale: "zh-Hant",
      streak: 4,
      dailyTasksCompleted: 3,
      dailyTasksTotal: 3,
      allDailyTasksDone: true,
      streakSafeToday: true,
      pendingTaskLabels: [" review ", "", "game"],
    },
    "user-1",
    now,
  );

  assert.equal(snapshot.date_key, "2026-08-07");
  assert.equal(snapshot.user_id, "user-1");
  assert.equal(snapshot.streak, 4);
  assert.equal(snapshot.daily_tasks_completed, 3);
  assert.equal(snapshot.all_daily_tasks_done, true);
  assert.deepEqual(snapshot.pending_task_labels, ["review", "game"]);
  assert.deepEqual(settingsPatch, {
    locale: "zh-Hant",
    timezone: "Asia/Hong_Kong",
  });
});

test("snapshot and cron date helper share the same timezone date key", () => {
  const now = new Date("2026-08-07T03:30:00.000Z");
  const timezone = "America/Los_Angeles";
  const { snapshot } = buildDailySnapshotRow(
    {
      dateKey: "2026-08-07",
      timezone,
    },
    "user-1",
    now,
  );
  const reminderTime = getReminderLocalDateParts(timezone, now);

  assert.equal(snapshot.date_key, reminderTime.dateKey);
  assert.equal(snapshot.date_key, "2026-08-06");
});

test("invalid snapshot timezones fall back to the default reminder timezone", () => {
  const now = new Date("2026-08-07T03:30:00.000Z");
  const { settingsPatch, snapshot } = buildDailySnapshotRow(
    {
      dateKey: "2026-08-06",
      timezone: "Invalid/Timezone",
    },
    "user-1",
    now,
  );

  assert.equal(settingsPatch.timezone, DEFAULT_REMINDER_TIMEZONE);
  assert.equal(snapshot.date_key, "2026-08-07");
});
