import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readRepoFile(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

function getWordbaseUpdatePolicy(sql) {
  const match = sql.match(
    /create policy "Authenticated users can update wordbase rows"[\s\S]*?with check \([\s\S]*?\);/u,
  );
  assert.ok(match, "Expected WordBase update policy to exist");
  return match[0];
}

test("WordBase update policies require contributor ownership or trusted admin role", async () => {
  const policyFiles = [
    "supabase/schema.sql",
    "supabase/wordbase_public_apply.sql",
    "supabase/migrations/20260615_wordbase_public.sql",
    "supabase/migrations/20260727_harden_role_and_wordbase_rls.sql",
  ];

  for (const file of policyFiles) {
    const policy = getWordbaseUpdatePolicy(await readRepoFile(file));
    assert.match(policy, /contributor_id\s*=\s*auth\.uid\(\)/u, file);
    assert.doesNotMatch(
      policy,
      /using\s*\(\s*auth\.uid\(\)\s+is\s+not\s+null\s*\)\s*with check\s*\(\s*auth\.uid\(\)\s+is\s+not\s+null\s*\)/iu,
      file,
    );
    assert.doesNotMatch(policy, /user_metadata/u, file);
  }
});

test("database admin role helpers ignore client-writable user metadata", async () => {
  const helperFiles = [
    "supabase/migrations/20260620_word_groups_phase1.sql",
    "supabase/migrations/20260727_harden_role_and_wordbase_rls.sql",
  ];

  for (const file of helperFiles) {
    const sql = await readRepoFile(file);
    const helper = sql.match(/create or replace function public\.current_app_role\(\)[\s\S]*?\$\$;/u)?.[0];
    assert.ok(helper, `Expected current_app_role helper in ${file}`);
    assert.match(helper, /app_metadata/u, file);
    assert.doesNotMatch(helper, /user_metadata/u, file);
  }
});
