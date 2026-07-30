import assert from "node:assert/strict";
import test from "node:test";

import { readTrustedAppRole } from "../server/api/_authz.js";
import { getRoleFromUser, ROLES } from "../src/lib/authorization.js";

test("server role checks ignore client-writable user metadata", () => {
  const user = {
    app_metadata: {},
    user_metadata: { role: "owner" },
    role: "authenticated",
  };

  assert.equal(readTrustedAppRole(user), "student");
});

test("client permissions ignore client-writable user metadata", () => {
  const user = {
    app_metadata: {},
    user_metadata: { role: "admin" },
    role: "authenticated",
  };

  assert.equal(getRoleFromUser(user), ROLES.STUDENT);
});

test("trusted app metadata still grants assigned roles", () => {
  const user = {
    app_metadata: { role: "Teacher" },
    user_metadata: { role: "owner" },
  };

  assert.equal(readTrustedAppRole(user), "teacher");
  assert.equal(getRoleFromUser(user), ROLES.TEACHER);
});
