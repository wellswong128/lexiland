import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { getRoleFromAuthUser } from "../server/api/_authz.js";
import { can, getRoleFromUser, PERMISSIONS } from "../src/lib/authorization.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const spoofedOwner = {
  app_metadata: {},
  user_metadata: { role: "owner" },
  role: "owner",
};

test("frontend roles ignore client-writable user metadata", () => {
  assert.equal(getRoleFromUser(spoofedOwner), "student");
  assert.equal(
    can(getRoleFromUser(spoofedOwner), PERMISSIONS.SETTINGS_MANAGE_USERS),
    false,
  );
});

test("server API roles ignore client-writable user metadata", () => {
  assert.equal(getRoleFromAuthUser(spoofedOwner), "student");
  assert.equal(
    getRoleFromAuthUser({ app_metadata: { role: "admin" }, user_metadata: { role: "student" } }),
    "admin",
  );
});

test("database role helpers only read app metadata for roles", async () => {
  const files = [
    "supabase/schema.sql",
    "supabase/word_groups_phase1_design.sql",
    "supabase/migrations/20260615_wordbase_public.sql",
    "supabase/migrations/20260620_word_groups_phase1.sql",
    "supabase/migrations/20260812_harden_roles_and_wordbase_rls.sql",
    "supabase/wordbase_public_apply.sql",
  ];

  for (const file of files) {
    const sql = await readFile(resolve(ROOT, file), "utf8");
    const roleFunction = sql.match(
      /create or replace function public\.current_app_role\(\)[\s\S]*?\$\$;/u,
    );

    assert.ok(roleFunction, `${file} defines current_app_role`);
    assert.match(roleFunction[0], /auth\.jwt\(\) -> 'app_metadata' ->> 'role'/u);
    assert.doesNotMatch(roleFunction[0], /user_metadata/u);
  }
});

test("wordbase update policy is limited to contributors and trusted admins", async () => {
  const files = [
    "supabase/schema.sql",
    "supabase/migrations/20260615_wordbase_public.sql",
    "supabase/migrations/20260812_harden_roles_and_wordbase_rls.sql",
    "supabase/wordbase_public_apply.sql",
  ];

  for (const file of files) {
    const sql = await readFile(resolve(ROOT, file), "utf8");

    assert.match(
      sql,
      /contributor_id = auth\.uid\(\) or public\.is_owner_or_admin\(\)/u,
      `${file} restricts updates to contributors or trusted admins`,
    );
    assert.doesNotMatch(
      sql,
      /on public\.wordbase for update\s+using \(auth\.uid\(\) is not null\)\s+with check \(auth\.uid\(\) is not null\)/u,
      `${file} does not allow every authenticated user to update wordbase`,
    );
  }
});
