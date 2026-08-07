import assert from "node:assert/strict";
import test from "node:test";

import { buildReminderSyncKey } from "../src/features/reminders/reminderSyncKey.js";

test("reminder sync keys dedupe identical snapshots for the same user", () => {
  const snapshot = {
    dateKey: "2026-08-07",
    timezone: "Asia/Hong_Kong",
    dailyTasksCompleted: 0,
  };

  assert.equal(
    buildReminderSyncKey("user-a", snapshot),
    buildReminderSyncKey("user-a", { ...snapshot }),
  );
});

test("reminder sync keys do not dedupe identical snapshots across users", () => {
  const snapshot = {
    dateKey: "2026-08-07",
    timezone: "Asia/Hong_Kong",
    dailyTasksCompleted: 0,
  };

  assert.notEqual(
    buildReminderSyncKey("user-a", snapshot),
    buildReminderSyncKey("user-b", snapshot),
  );
});
