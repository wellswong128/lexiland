import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { verifyCronSecret } from "../server/api/handlers/cron-evening-reminders.js";

const originalCronSecret = process.env.CRON_SECRET;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalCronSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalCronSecret;
  }

  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

test("cron secret is required outside production", () => {
  delete process.env.CRON_SECRET;
  process.env.NODE_ENV = "development";

  assert.equal(verifyCronSecret({ headers: {} }), false);
});

test("cron secret is required in production", () => {
  delete process.env.CRON_SECRET;
  process.env.NODE_ENV = "production";

  assert.equal(verifyCronSecret({ headers: {} }), false);
});

test("cron secret accepts matching bearer token", () => {
  process.env.CRON_SECRET = "local-test-secret";
  process.env.NODE_ENV = "development";

  assert.equal(
    verifyCronSecret({ headers: { authorization: "Bearer local-test-secret" } }),
    true,
  );
});

test("cron secret rejects missing or wrong bearer token", () => {
  process.env.CRON_SECRET = "local-test-secret";
  process.env.NODE_ENV = "development";

  assert.equal(verifyCronSecret({ headers: {} }), false);
  assert.equal(
    verifyCronSecret({ headers: { Authorization: "Bearer other-secret" } }),
    false,
  );
});
