import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const helperPath = fileURLToPath(
  new URL("../scripts/wordbase_import/load-env-local.sh", import.meta.url),
);

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function resolveWithEnvFile(envFileContent, initialEnv = {}) {
  const root = mkdtempSync(join(tmpdir(), "lexiland-bulk-env-"));
  try {
    writeFileSync(join(root, ".env.local"), envFileContent, "utf8");
    const command = [
      `ROOT=${shellQuote(root)}`,
      `source ${shellQuote(helperPath)}`,
      "resolve_bulk_api_env",
      `printf 'APP_API_BASE_URL=%s\\nALLOW_PRODUCTION_BULK_API=%s\\n' "$APP_API_BASE_URL" "\${ALLOW_PRODUCTION_BULK_API-__unset__}"`,
    ].join("; ");
    const result = spawnSync("bash", ["-c", command], {
      env: {
        PATH: process.env.PATH,
        ...initialEnv,
      },
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    return Object.fromEntries(
      result.stdout
        .trim()
        .split("\n")
        .map((line) => line.split("=", 2)),
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

test("production API URL does not implicitly allow bulk production calls", () => {
  const env = resolveWithEnvFile("APP_API_BASE_URL=https://learn.lexiland.cc\n");
  assert.equal(env.APP_API_BASE_URL, "https://learn.lexiland.cc");
  assert.equal(env.ALLOW_PRODUCTION_BULK_API, "__unset__");
});

test("explicit production bulk opt-in is preserved", () => {
  const env = resolveWithEnvFile(
    "APP_API_BASE_URL=https://learn.lexiland.cc\nALLOW_PRODUCTION_BULK_API=1\n",
  );
  assert.equal(env.APP_API_BASE_URL, "https://learn.lexiland.cc");
  assert.equal(env.ALLOW_PRODUCTION_BULK_API, "1");
});

test("non-production API targets clear production bulk opt-in", () => {
  const env = resolveWithEnvFile("APP_API_BASE_URL=http://localhost:5173\n", {
    ALLOW_PRODUCTION_BULK_API: "1",
  });
  assert.equal(env.APP_API_BASE_URL, "http://localhost:5173");
  assert.equal(env.ALLOW_PRODUCTION_BULK_API, "__unset__");
});
