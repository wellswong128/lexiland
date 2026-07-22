import assert from "node:assert/strict";
import test from "node:test";

import { readTrustedAppRole } from "../server/api/_roles.js";
import { getRoleFromUser, ROLES } from "../src/lib/authorization.js";

test("server authorization ignores user-writable metadata roles", () => {
  assert.equal(
    readTrustedAppRole({
      user_metadata: { role: "owner" },
    }),
    "student",
  );
});

test("server authorization trusts app metadata roles", () => {
  assert.equal(
    readTrustedAppRole({
      app_metadata: { role: "Admin" },
      user_metadata: { role: "owner" },
    }),
    "admin",
  );
});

test("client route authorization ignores user-writable metadata roles", () => {
  assert.equal(
    getRoleFromUser({
      user_metadata: { role: "owner" },
    }),
    ROLES.STUDENT,
  );
});

test("client route authorization trusts app metadata roles", () => {
  assert.equal(
    getRoleFromUser({
      app_metadata: { role: "teacher" },
      user_metadata: { role: "owner" },
    }),
    ROLES.TEACHER,
  );
});
