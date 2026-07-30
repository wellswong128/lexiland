import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function currentAppRoleFunction(sql) {
  const match = sql.match(/create or replace function public\.current_app_role\(\)[\s\S]*?\$\$;/u);
  assert.ok(match, "expected current_app_role() definition");
  return match[0];
}

function assertTrustedRoleHelper(relativePath) {
  const helperSql = currentAppRoleFunction(read(relativePath));

  assert.match(helperSql, /auth\.jwt\(\)\s*->\s*'app_metadata'\s*->>\s*'role'/u);
  assert.doesNotMatch(helperSql, /user_metadata/u);
}

function assertHardenedWordbaseUpdatePolicy(relativePath) {
  const sql = read(relativePath);

  assert.match(sql, /drop policy if exists "Authenticated users can update wordbase rows"/u);
  assert.match(sql, /contributor_id\s*=\s*auth\.uid\(\)/u);
  assert.match(sql, /public\.current_app_role\(\)\s+in\s+\('owner',\s*'admin'\)/u);
  assert.doesNotMatch(sql, /using\s*\(\s*auth\.uid\(\)\s+is\s+not\s+null\s*\)\s*with check\s*\(\s*auth\.uid\(\)\s+is\s+not\s+null\s*\)/u);
}

test("SQL role helpers trust only app metadata", () => {
  assertTrustedRoleHelper("supabase/schema.sql");
  assertTrustedRoleHelper("supabase/migrations/20260620_word_groups_phase1.sql");
  assertTrustedRoleHelper("supabase/migrations/20260730_harden_role_and_wordbase_rls.sql");
  assertTrustedRoleHelper("supabase/word_groups_phase1_design.sql");
  assertTrustedRoleHelper("supabase/wordbase_public_apply.sql");
});

test("WordBase update policy requires row contributor or trusted admin role", () => {
  assertHardenedWordbaseUpdatePolicy("supabase/migrations/20260730_harden_role_and_wordbase_rls.sql");
  assertHardenedWordbaseUpdatePolicy("supabase/wordbase_public_apply.sql");

  const schemaSql = read("supabase/schema.sql");
  assert.match(schemaSql, /contributor_id\s*=\s*auth\.uid\(\)/u);
  assert.match(schemaSql, /public\.current_app_role\(\)\s+in\s+\('owner',\s*'admin'\)/u);
});
