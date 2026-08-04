import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url);

function readRepoFile(path) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

function normalizeSql(sql) {
  return sql.replace(/\s+/g, " ").trim();
}

test("SQL role helpers never trust client-writable user_metadata roles", () => {
  const roleSqlFiles = [
    "supabase/migrations/20260620_word_groups_phase1.sql",
    "supabase/migrations/20260804_harden_role_and_wordbase_rls.sql",
    "supabase/word_groups_phase1_design.sql",
  ];

  for (const file of roleSqlFiles) {
    const sql = readRepoFile(file);
    assert.equal(
      sql.includes("auth.jwt() -> 'user_metadata' ->> 'role'"),
      false,
      `${file} must not authorize from user_metadata.role`,
    );
  }
});

test("WordBase update RLS requires contributor ownership or trusted owner/admin role", () => {
  const policyFiles = [
    "supabase/schema.sql",
    "supabase/wordbase_public_apply.sql",
    "supabase/migrations/20260615_wordbase_public.sql",
    "supabase/migrations/20260804_harden_role_and_wordbase_rls.sql",
  ];

  for (const file of policyFiles) {
    const sql = normalizeSql(readRepoFile(file));
    assert.match(
      sql,
      /create policy "Authenticated users can update wordbase rows" on public\.wordbase for update using \(/i,
      `${file} must define the WordBase update policy`,
    );
    assert.match(sql, /contributor_id = auth\.uid\(\)/i, `${file} must require contributor ownership`);
    assert.match(sql, /'owner', 'admin'/i, `${file} must preserve trusted admin override`);
    assert.doesNotMatch(
      sql,
      /on public\.wordbase for update using \(auth\.uid\(\) is not null\) with check \(auth\.uid\(\) is not null\)/i,
      `${file} must not allow every authenticated user to update every row`,
    );
  }
});
