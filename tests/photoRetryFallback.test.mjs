import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("photo AI retry keeps fallback suggestions blocked from saving", async () => {
  const source = await readFile(
    path.join(repoRoot, "src/components/PhotoWordCapture.jsx"),
    "utf8",
  );

  assert.doesNotMatch(source, /usedFallback:\s*false/u);
  assert.match(source, /if \(result\.usedFallback\) \{/u);
  assert.match(source, /usedFallback:\s*Boolean\(result\.usedFallback\)/u);
});
