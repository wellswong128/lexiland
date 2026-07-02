import assert from "node:assert/strict";
import test from "node:test";

import { getTrustedRoleFromUser } from "../server/api/_authz.js";

test("server authorization trusts app_metadata role", () => {
  assert.equal(
    getTrustedRoleFromUser({
      app_metadata: { role: " Admin " },
      user_metadata: { role: "student" },
      role: "authenticated",
    }),
    "admin",
  );
});

test("server authorization ignores user-editable metadata roles", () => {
  assert.equal(
    getTrustedRoleFromUser({
      app_metadata: {},
      user_metadata: { role: "owner" },
      role: "authenticated",
    }),
    "student",
  );
});

test("server authorization ignores Supabase auth role", () => {
  assert.equal(
    getTrustedRoleFromUser({
      app_metadata: {},
      user_metadata: {},
      role: "service_role",
    }),
    "student",
  );
});

test("server authorization defaults invalid app roles to student", () => {
  assert.equal(
    getTrustedRoleFromUser({
      app_metadata: { role: "superadmin" },
      user_metadata: { role: "owner" },
    }),
    "student",
  );
});
