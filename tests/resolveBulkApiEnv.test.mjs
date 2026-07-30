import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function resolveBulkApiEnv(envLocal) {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "lexiland-bulk-env-"));

  try {
    writeFileSync(resolve(tempRoot, ".env.local"), envLocal);

    const script = [
      `ROOT=${shellQuote(tempRoot)}`,
      "source scripts/wordbase_import/load-env-local.sh",
      "resolve_bulk_api_env",
      'printf "%s\\n%s\\n" "$APP_API_BASE_URL" "${ALLOW_PRODUCTION_BULK_API-unset}"',
    ].join("; ");

    return execFileSync("bash", ["-lc", script], {
      cwd: root,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
      },
    }).trimEnd().split("\n");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

test("production API URL does not implicitly allow bulk writes", () => {
  const [apiBaseUrl, allowProductionBulkApi] = resolveBulkApiEnv(
    "APP_API_BASE_URL=https://learn.lexiland.cc\n",
  );

  assert.equal(apiBaseUrl, "https://learn.lexiland.cc");
  assert.equal(allowProductionBulkApi, "unset");
});

test("explicit production bulk API opt-in is preserved", () => {
  const [apiBaseUrl, allowProductionBulkApi] = resolveBulkApiEnv(
    [
      "APP_API_BASE_URL=https://learn.lexiland.cc",
      "ALLOW_PRODUCTION_BULK_API=1",
      "",
    ].join("\n"),
  );

  assert.equal(apiBaseUrl, "https://learn.lexiland.cc");
  assert.equal(allowProductionBulkApi, "1");
});
