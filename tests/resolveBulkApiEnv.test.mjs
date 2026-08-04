import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url);
const SCRIPT = new URL("../scripts/wordbase_import/load-env-local.sh", import.meta.url).pathname;

function runResolver(envFile, extraEnv = {}) {
  const tempDir = mkdtempSync(join(tmpdir(), "lexiland-env-"));

  try {
    writeFileSync(join(tempDir, ".env.local"), envFile);
    const output = execFileSync(
      "bash",
      [
        "-lc",
        [
          `ROOT=${JSON.stringify(tempDir)}`,
          `source ${JSON.stringify(SCRIPT)}`,
          "resolve_bulk_api_env",
          'printf "APP_API_BASE_URL=%s\\nALLOW_PRODUCTION_BULK_API=%s\\n" "$APP_API_BASE_URL" "${ALLOW_PRODUCTION_BULK_API-}"',
        ].join("; "),
      ],
      {
        cwd: new URL(".", ROOT),
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          ...extraEnv,
        },
        encoding: "utf8",
      },
    );

    return Object.fromEntries(
      output
        .trim()
        .split("\n")
        .map((line) => line.split("=")),
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

test("production API target does not implicitly allow production bulk writes", () => {
  const result = runResolver("APP_API_BASE_URL=https://learn.lexiland.cc\n");

  assert.equal(result.APP_API_BASE_URL, "https://learn.lexiland.cc");
  assert.equal(result.ALLOW_PRODUCTION_BULK_API, "");
});

test("explicit production allow flag is preserved for intentional jobs", () => {
  const result = runResolver(
    "APP_API_BASE_URL=https://learn.lexiland.cc\nALLOW_PRODUCTION_BULK_API=1\n",
  );

  assert.equal(result.APP_API_BASE_URL, "https://learn.lexiland.cc");
  assert.equal(result.ALLOW_PRODUCTION_BULK_API, "1");
});

test("non-production targets clear stale production allow flags", () => {
  const result = runResolver("APP_API_BASE_URL=http://localhost:5173\n", {
    ALLOW_PRODUCTION_BULK_API: "1",
  });

  assert.equal(result.APP_API_BASE_URL, "http://localhost:5173");
  assert.equal(result.ALLOW_PRODUCTION_BULK_API, "");
});
