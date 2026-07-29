import assert from "node:assert/strict";
import test from "node:test";

import { readTrustedAppRole } from "../server/api/_authz.js";
import { getRoleFromUser, ROLES } from "../src/lib/authorization.js";

test("server auth ignores client-writable user_metadata.role", () => {
  assert.equal(
    readTrustedAppRole({
      app_metadata: {},
      user_metadata: { role: "admin" },
    }),
    "student",
  );
});

test("server auth trusts service-controlled app_metadata.role", () => {
  assert.equal(
    readTrustedAppRole({
      app_metadata: { role: "admin" },
      user_metadata: { role: "student" },
    }),
    "admin",
  );
});

test("frontend route role ignores client-writable user_metadata.role", () => {
  assert.equal(
    getRoleFromUser({
      app_metadata: {},
      user_metadata: { role: "owner" },
    }),
    ROLES.STUDENT,
  );
});
