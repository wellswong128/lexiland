import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sqlFiles = [
  "supabase/schema.sql",
  "supabase/migrations/20260615_wordbase_public.sql",
  "supabase/migrations/20260620_word_groups_phase1.sql",
  "supabase/migrations/20260722_harden_role_and_wordbase_rls.sql",
  "supabase/word_groups_phase1_design.sql",
  "supabase/wordbase_public_apply.sql",
];

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function getWordbaseUpdatePolicy(sql) {
  const match = sql.match(
    /create policy "Authenticated users can update wordbase rows"[\s\S]*?;\n/u,
  );
  assert.ok(match, "wordbase update policy should exist");
  return match[0];
}

test("database role helper does not trust user metadata roles", () => {
  for (const file of sqlFiles) {
    assert.equal(
      read(file).includes("auth.jwt() -> 'user_metadata' ->> 'role'"),
      false,
      `${file} should not read roles from user_metadata`,
    );
  }
});

test("WordBase updates are limited to contributors or app-metadata admins", () => {
  for (const file of [
    "supabase/schema.sql",
    "supabase/migrations/20260615_wordbase_public.sql",
    "supabase/migrations/20260722_harden_role_and_wordbase_rls.sql",
    "supabase/wordbase_public_apply.sql",
  ]) {
    const policy = getWordbaseUpdatePolicy(read(file));
    assert.match(policy, /contributor_id = auth\.uid\(\)/u);
    assert.match(policy, /app_metadata|current_app_role/u);
    assert.doesNotMatch(policy, /using \(auth\.uid\(\) is not null\)\s*with check \(auth\.uid\(\) is not null\)/u);
  }
});
