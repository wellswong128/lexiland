import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { normalizeRole as normalizeServerRole } from "../server/api/_authz.js";
import { getRoleFromUser, ROLES } from "../src/lib/authorization.js";

test("server role normalization ignores user-editable metadata", () => {
  assert.equal(
    normalizeServerRole({
      app_metadata: {},
      user_metadata: { role: "owner" },
      role: "admin",
    }),
    "student",
  );

  assert.equal(
    normalizeServerRole({
      app_metadata: { role: "ADMIN" },
      user_metadata: { role: "student" },
    }),
    "admin",
  );
});

test("client route authorization ignores user-editable metadata", () => {
  assert.equal(
    getRoleFromUser({
      app_metadata: {},
      user_metadata: { role: "owner" },
      role: "admin",
    }),
    ROLES.STUDENT,
  );

  assert.equal(
    getRoleFromUser({
      app_metadata: { role: "teacher" },
      user_metadata: { role: "owner" },
    }),
    ROLES.TEACHER,
  );
});

test("current_app_role migration trusts app_metadata only", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20260721_trust_app_metadata_roles.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /app_metadata/u);
  assert.doesNotMatch(migration, /user_metadata/u);
});
