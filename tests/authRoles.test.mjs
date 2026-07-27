import assert from "node:assert/strict";
import test from "node:test";

import { readTrustedAppRole } from "../server/api/_authz.js";
import { getRoleFromUser, ROLES } from "../src/lib/authorization.js";

test("server role checks ignore client-writable user metadata", () => {
  assert.equal(
    readTrustedAppRole({
      app_metadata: {},
      user_metadata: { role: "owner" },
    }),
    "student",
  );
});

test("server role checks trust app metadata roles", () => {
  assert.equal(
    readTrustedAppRole({
      app_metadata: { role: "Admin" },
      user_metadata: { role: "student" },
    }),
    "admin",
  );
});

test("client route permissions ignore client-writable user metadata", () => {
  assert.equal(
    getRoleFromUser({
      app_metadata: {},
      user_metadata: { role: "owner" },
    }),
    ROLES.STUDENT,
  );
});

test("client route permissions trust app metadata roles", () => {
  assert.equal(
    getRoleFromUser({
      app_metadata: { role: "owner" },
      user_metadata: { role: "student" },
    }),
    ROLES.OWNER,
  );
});
