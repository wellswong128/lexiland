import test from "node:test";
import assert from "node:assert/strict";

import { readTrustedAppRole } from "../server/api/_authz.js";
import { can, getRoleFromUser, PERMISSIONS, ROLES } from "../src/lib/authorization.js";

test("server auth trusts app_metadata role only", () => {
  assert.equal(
    readTrustedAppRole({
      app_metadata: {},
      user_metadata: { role: "owner" },
      role: "owner",
    }),
    "student",
  );

  assert.equal(
    readTrustedAppRole({
      app_metadata: { role: "ADMIN" },
      user_metadata: { role: "student" },
    }),
    "admin",
  );

  assert.equal(readTrustedAppRole({ app_metadata: { role: "superuser" } }), "student");
});

test("client permissions ignore user_metadata role escalation", () => {
  const role = getRoleFromUser({
    app_metadata: {},
    user_metadata: { role: "owner" },
    role: "owner",
  });

  assert.equal(role, ROLES.STUDENT);
  assert.equal(can(role, PERMISSIONS.SETTINGS_MANAGE_USERS), false);
});

test("client permissions allow trusted app_metadata roles", () => {
  const role = getRoleFromUser({
    app_metadata: { role: "owner" },
    user_metadata: { role: "student" },
  });

  assert.equal(role, ROLES.OWNER);
  assert.equal(can(role, PERMISSIONS.SETTINGS_MANAGE_USERS), true);
});
