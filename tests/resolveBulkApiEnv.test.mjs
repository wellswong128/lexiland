import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = path.join(repoRoot, "scripts/wordbase_import/load-env-local.sh");

async function withTempRoot(envFileContent, callback) {
  const root = await mkdtemp(path.join(tmpdir(), "lexiland-bulk-env-"));
  try {
    if (envFileContent) {
      await writeFile(path.join(root, ".env.local"), envFileContent, "utf8");
    }
    return await callback(root);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

function resolveBulkEnv(root, env = {}) {
  const command = [
    "set -euo pipefail",
    `ROOT=${JSON.stringify(root)}`,
    `source ${JSON.stringify(scriptPath)}`,
    "resolve_bulk_api_env",
    "printf 'APP_API_BASE_URL=%s\\n' \"$APP_API_BASE_URL\"",
    "printf 'ALLOW_PRODUCTION_BULK_API=%s\\n' \"${ALLOW_PRODUCTION_BULK_API-}\"",
  ].join("; ");

  const result = spawnSync("bash", ["-lc", command], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      ...env,
    },
  });

  assert.equal(result.status, 0, result.stderr);

  return Object.fromEntries(
    result.stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

test("production bulk API flag is not inferred from a production target URL", async () => {
  await withTempRoot("APP_API_BASE_URL=https://learn.lexiland.cc\n", (root) => {
    assert.deepEqual(resolveBulkEnv(root), {
      APP_API_BASE_URL: "https://learn.lexiland.cc",
      ALLOW_PRODUCTION_BULK_API: "",
    });
  });
});

test("explicit production bulk API flag is preserved for production targets", async () => {
  await withTempRoot(
    [
      "APP_API_BASE_URL=https://learn.lexiland.cc",
      "ALLOW_PRODUCTION_BULK_API=1",
      "",
    ].join("\n"),
    (root) => {
      assert.deepEqual(resolveBulkEnv(root), {
        APP_API_BASE_URL: "https://learn.lexiland.cc",
        ALLOW_PRODUCTION_BULK_API: "1",
      });
    },
  );
});

test("production bulk API flag is cleared for local targets", async () => {
  await withTempRoot("APP_API_BASE_URL=http://localhost:5173\nALLOW_PRODUCTION_BULK_API=1\n", (root) => {
    assert.deepEqual(resolveBulkEnv(root), {
      APP_API_BASE_URL: "http://localhost:5173",
      ALLOW_PRODUCTION_BULK_API: "",
    });
  });
});
