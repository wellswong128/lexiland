import assert from "node:assert/strict";
import test from "node:test";

import { runEveningReminderJob } from "../server/lib/eveningReminderJob.js";

const EVENING_HK_TIME = new Date("2026-07-05T12:15:00.000Z");

function createAdminClient({ claimError = null } = {}) {
  const state = {
    settingsRow: {
      user_id: "user-1",
      timezone: "Asia/Hong_Kong",
      locale: "en",
      last_reminder_sent_date: null,
      evening_reminder_enabled: true,
    },
    snapshot: {
      user_id: "user-1",
      date_key: "2026-07-05",
      streak: 3,
      pending_task_labels: ["Review flashcards"],
      daily_tasks_completed: 1,
      daily_tasks_total: 3,
      all_daily_tasks_done: false,
      streak_safe_today: false,
    },
    claimError,
  };

  class Query {
    constructor(table) {
      this.table = table;
      this.filters = new Map();
      this.patch = null;
      this.orExpression = "";
    }

    select() {
      return this;
    }

    eq(column, value) {
      this.filters.set(column, value);
      return this;
    }

    or(expression) {
      this.orExpression = expression;
      return this;
    }

    update(patch) {
      this.patch = patch;
      return this;
    }

    async maybeSingle() {
      if (this.table === "user_daily_snapshots") {
        return { data: state.snapshot, error: null };
      }

      if (this.table !== "user_reminder_settings" || !this.patch) {
        return { data: null, error: null };
      }

      if (state.claimError) {
        return { data: null, error: { message: state.claimError } };
      }

      const dateKey = this.patch.last_reminder_sent_date;
      const isSameUser = this.filters.get("user_id") === state.settingsRow.user_id;
      const isEnabled = this.filters.get("evening_reminder_enabled") === true;
      const alreadyClaimed = String(state.settingsRow.last_reminder_sent_date || "").slice(0, 10) === dateKey;

      if (!isSameUser || !isEnabled || alreadyClaimed) {
        return { data: null, error: null };
      }

      assert.match(this.orExpression, /last_reminder_sent_date\.is\.null/);
      assert.match(this.orExpression, /last_reminder_sent_date\.neq\.2026-07-05/);

      state.settingsRow = {
        ...state.settingsRow,
        ...this.patch,
      };

      return { data: { user_id: state.settingsRow.user_id }, error: null };
    }

    async execute() {
      if (this.table !== "user_reminder_settings") {
        return { data: [], error: null };
      }

      if (this.filters.get("evening_reminder_enabled") === true && state.settingsRow.evening_reminder_enabled) {
        return { data: [{ ...state.settingsRow }], error: null };
      }

      return { data: [], error: null };
    }

    then(onFulfilled, onRejected) {
      return this.execute().then(onFulfilled, onRejected);
    }
  }

  return {
    state,
    auth: {
      admin: {
        async getUserById(userId) {
          assert.equal(userId, state.settingsRow.user_id);
          return { data: { user: { email: "student@example.com" } }, error: null };
        },
      },
    },
    from(table) {
      return new Query(table);
    },
  };
}

test("does not send a reminder when the sent-date claim fails", async () => {
  const adminClient = createAdminClient({ claimError: "database timeout" });
  let sendCount = 0;

  const result = await runEveningReminderJob(adminClient, {
    now: EVENING_HK_TIME,
    emailConfigured: () => true,
    sendReminderEmail: async () => {
      sendCount += 1;
    },
  });

  assert.equal(sendCount, 0);
  assert.equal(adminClient.state.settingsRow.last_reminder_sent_date, null);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].message, "database timeout");
});

test("claims the reminder before sending so retries skip the same local day", async () => {
  const adminClient = createAdminClient();
  let sendCount = 0;

  const firstResult = await runEveningReminderJob(adminClient, {
    now: EVENING_HK_TIME,
    emailConfigured: () => true,
    sendReminderEmail: async () => {
      sendCount += 1;
      assert.equal(adminClient.state.settingsRow.last_reminder_sent_date, "2026-07-05");
    },
  });

  assert.equal(firstResult.ok, true);
  assert.equal(firstResult.sent, 1);
  assert.equal(sendCount, 1);

  const retryResult = await runEveningReminderJob(adminClient, {
    now: EVENING_HK_TIME,
    emailConfigured: () => true,
    sendReminderEmail: async () => {
      sendCount += 1;
    },
  });

  assert.equal(retryResult.ok, true);
  assert.equal(retryResult.sent, 0);
  assert.equal(retryResult.skipped, 1);
  assert.equal(sendCount, 1);
});
