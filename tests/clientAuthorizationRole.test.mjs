import assert from "node:assert/strict";
import test from "node:test";

import {
  can,
  getRoleFromUser,
  PERMISSIONS,
  ROLES,
} from "../src/lib/authorization.js";

test("client authorization trusts app_metadata role", () => {
  const role = getRoleFromUser({
    app_metadata: { role: " Admin " },
    user_metadata: { role: "student" },
    role: "authenticated",
  });

  assert.equal(role, ROLES.ADMIN);
  assert.equal(can(role, PERMISSIONS.SETTINGS_MANAGE_USERS), true);
});

test("client authorization ignores user-editable metadata roles", () => {
  const role = getRoleFromUser({
    app_metadata: {},
    user_metadata: { role: "owner" },
    role: "authenticated",
  });

  assert.equal(role, ROLES.STUDENT);
  assert.equal(can(role, PERMISSIONS.SETTINGS_MANAGE_USERS), false);
});

test("client authorization defaults unauthenticated users to guest", () => {
  assert.equal(getRoleFromUser(null), ROLES.GUEST);
});

test("client authorization ignores Supabase auth role", () => {
  assert.equal(
    getRoleFromUser({
      app_metadata: {},
      role: "service_role",
    }),
    ROLES.STUDENT,
  );
});
