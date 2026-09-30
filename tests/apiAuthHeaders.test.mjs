import assert from "node:assert/strict";
import { test } from "node:test";

import { buildApiAuthHeaders } from "../src/lib/apiAuthHeaders.js";

test("buildApiAuthHeaders returns bearer token for matching user", () => {
  assert.deepEqual(
    buildApiAuthHeaders(
      { access_token: "token-a", user: { id: "user-a" } },
      { expectedUserId: "user-a" },
    ),
    { Authorization: "Bearer token-a" },
  );
});

test("buildApiAuthHeaders withholds auth when the session user changed", () => {
  assert.deepEqual(
    buildApiAuthHeaders(
      { access_token: "token-b", user: { id: "user-b" } },
      { expectedUserId: "user-a" },
    ),
    {},
  );
});

test("buildApiAuthHeaders preserves existing callers without a user guard", () => {
  assert.deepEqual(
    buildApiAuthHeaders({ access_token: "token-b", user: { id: "user-b" } }),
    { Authorization: "Bearer token-b" },
  );
});
