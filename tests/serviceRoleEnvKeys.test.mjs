import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

const SERVER_ADMIN_CLIENT_FILES = [
  "server/api/_admin-supabase.js",
  "server/api/handlers/admin-users.js",
  "server/api/handlers/admin-wordbase.js",
  "server/api/handlers/admin-wordbase-library.js",
];

const PUBLIC_SERVICE_ROLE_KEY_PATTERNS = [
  /VITE_[A-Z0-9_]*(?:SERVICE_ROLE|SECRET)[A-Z0-9_]*/u,
  /NEXT_PUBLIC_[A-Z0-9_]*(?:SERVICE_ROLE|SECRET)[A-Z0-9_]*/u,
  /PUBLIC_[A-Z0-9_]*(?:SERVICE_ROLE|SECRET)[A-Z0-9_]*/u,
];

test("server admin clients do not accept public-prefixed service role keys", async () => {
  for (const filePath of SERVER_ADMIN_CLIENT_FILES) {
    const source = await readFile(filePath, "utf8");
    for (const pattern of PUBLIC_SERVICE_ROLE_KEY_PATTERNS) {
      assert.equal(
        pattern.test(source),
        false,
        `${filePath} must not accept public-prefixed Supabase service-role env keys.`,
      );
    }
  }
});
