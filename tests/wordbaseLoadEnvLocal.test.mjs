import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const scriptPath = new URL("../scripts/wordbase_import/load-env-local.sh", import.meta.url)
  .pathname;

function resolveBulkApiEnv(envFile, env = {}) {
  const root = mkdtempSync(join(tmpdir(), "lexiland-env-"));
  if (envFile) {
    writeFileSync(join(root, ".env.local"), envFile);
  }

  const result = spawnSync(
    "bash",
    [
      "-c",
      [
        "set -euo pipefail",
        `source "${scriptPath}"`,
        "resolve_bulk_api_env",
        "printf 'APP_API_BASE_URL=%s\\n' \"$APP_API_BASE_URL\"",
        "printf 'ALLOW_PRODUCTION_BULK_API=%s\\n' \"${ALLOW_PRODUCTION_BULK_API-}\"",
      ].join("; "),
    ],
    {
      env: {
        PATH: process.env.PATH,
        ROOT: root,
        ...env,
      },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr);
  return Object.fromEntries(
    result.stdout
      .trim()
      .split("\n")
      .map((line) => line.split("=", 2)),
  );
}

test("production bulk API stays blocked unless explicitly allowed", () => {
  const env = resolveBulkApiEnv("APP_API_BASE_URL=https://learn.lexiland.cc\n");

  assert.equal(env.APP_API_BASE_URL, "https://learn.lexiland.cc");
  assert.equal(env.ALLOW_PRODUCTION_BULK_API, "");
});

test("explicit production bulk API opt-in is preserved", () => {
  const env = resolveBulkApiEnv(
    "APP_API_BASE_URL=https://learn.lexiland.cc\nALLOW_PRODUCTION_BULK_API=1\n",
  );

  assert.equal(env.APP_API_BASE_URL, "https://learn.lexiland.cc");
  assert.equal(env.ALLOW_PRODUCTION_BULK_API, "1");
});

test("non-production targets clear stale production bulk opt-in", () => {
  const env = resolveBulkApiEnv("APP_API_BASE_URL=http://localhost:5174\n", {
    ALLOW_PRODUCTION_BULK_API: "1",
  });

  assert.equal(env.APP_API_BASE_URL, "http://localhost:5174");
  assert.equal(env.ALLOW_PRODUCTION_BULK_API, "");
});
