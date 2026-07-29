import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sqlFiles = [
  "supabase/migrations/20260620_word_groups_phase1.sql",
  "supabase/word_groups_phase1_design.sql",
  "supabase/migrations/20260729_harden_role_wordbase_rls.sql",
];

test("SQL role helpers do not trust user_metadata.role", () => {
  for (const file of sqlFiles) {
    const content = readFileSync(file, "utf8");
    assert.doesNotMatch(content, /user_metadata'\s*->>\s*'role'/u, file);
  }
});

test("WordBase update policies are scoped to contributors or trusted admins", () => {
  const files = [
    "supabase/schema.sql",
    "supabase/migrations/20260615_wordbase_public.sql",
    "supabase/wordbase_public_apply.sql",
    "supabase/migrations/20260729_harden_role_wordbase_rls.sql",
  ];

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    assert.match(content, /Contributors and admins can update wordbase rows/u, file);
    assert.match(content, /contributor_id\s*=\s*auth\.uid\(\)/u, file);
    assert.doesNotMatch(
      content,
      /for update\s+using\s*\(\s*auth\.uid\(\)\s+is\s+not\s+null\s*\)\s+with check\s*\(\s*auth\.uid\(\)\s+is\s+not\s+null\s*\)/iu,
      file,
    );
  }
});

test("incomplete WordBase maintenance RPC is revoked from all authenticated users", () => {
  const content = readFileSync(
    "supabase/migrations/20260729_harden_role_wordbase_rls.sql",
    "utf8",
  );

  assert.match(
    content,
    /revoke execute on function public\.get_incomplete_wordbase_rows\(integer, text\) from authenticated;/iu,
  );
  assert.match(
    content,
    /grant execute on function public\.get_incomplete_wordbase_rows\(integer, text\) to service_role;/iu,
  );
});
