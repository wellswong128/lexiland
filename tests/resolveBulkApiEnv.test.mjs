import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function runResolveBulkApiEnv(envContent, initialEnv = {}) {
  const root = mkdtempSync(join(tmpdir(), "lexiland-env-"));
  writeFileSync(join(root, ".env.local"), envContent);

  try {
    const envExports = Object.entries(initialEnv)
      .map(([key, value]) => `export ${key}=${JSON.stringify(value)};`)
      .join(" ");
    return execFileSync(
      "bash",
      [
        "-lc",
        [
          `ROOT=${JSON.stringify(root)}`,
          `source ${JSON.stringify(join(process.cwd(), "scripts/wordbase_import/load-env-local.sh"))}`,
          "unset APP_API_BASE_URL ALLOW_PRODUCTION_BULK_API",
          envExports,
          "resolve_bulk_api_env",
          "printf 'APP_API_BASE_URL=%s\\nALLOW_PRODUCTION_BULK_API=%s\\n' \"$APP_API_BASE_URL\" \"${ALLOW_PRODUCTION_BULK_API-}\"",
        ].join("; "),
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("production API URL does not auto-enable bulk writes", () => {
  const output = runResolveBulkApiEnv("APP_API_BASE_URL=https://learn.lexiland.cc\n");

  assert.match(output, /APP_API_BASE_URL=https:\/\/learn\.lexiland\.cc/u);
  assert.match(output, /ALLOW_PRODUCTION_BULK_API=\n/u);
});

test("explicit ALLOW_PRODUCTION_BULK_API is preserved for production API", () => {
  const output = runResolveBulkApiEnv(
    "APP_API_BASE_URL=https://learn.lexiland.cc\nALLOW_PRODUCTION_BULK_API=1\n",
  );

  assert.match(output, /ALLOW_PRODUCTION_BULK_API=1/u);
});
