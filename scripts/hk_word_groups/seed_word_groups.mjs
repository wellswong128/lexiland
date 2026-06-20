#!/usr/bin/env node

/**
 * Seed curriculum word groups from data/hk_word_groups/taxonomy.json into Supabase.
 *
 * Requires service role env vars (see api/_admin-supabase.js), typically in .env.local:
 *   VITE_SUPABASE_URL=https://<project>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Usage:
 *   npm run word-groups:seed:dry-run
 *   npm run word-groups:seed
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAdminServiceClient } from "../../api/_admin-supabase.js";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, "../..");
const TAXONOMY_PATH = resolve(PROJECT_ROOT, "data/hk_word_groups/taxonomy.json");

const args = new Set(process.argv.slice(2));
const isDryRun = args.has("--dry-run");

function normalizeLower(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeUpper(value) {
  return String(value ?? "").trim().toUpperCase();
}

function buildGroupCode(level, grade, subject) {
  return `hk-${normalizeLower(level)}-${normalizeLower(grade)}-${normalizeLower(subject)}`;
}

function loadTaxonomy() {
  const raw = readFileSync(TAXONOMY_PATH, "utf8");
  return JSON.parse(raw);
}

function mapCurriculumGroup(group, localeDefault) {
  const level = normalizeLower(group.level);
  const grade = normalizeUpper(group.grade);
  const subject = normalizeLower(group.subject);
  const groupCode = normalizeLower(group.group_code);
  const expectedCode = buildGroupCode(level, grade, subject);

  if (groupCode !== expectedCode) {
    throw new Error(
      `group_code mismatch for ${groupCode}: expected ${expectedCode} from level/grade/subject.`,
    );
  }

  if (!["primary", "secondary"].includes(level)) {
    throw new Error(`unsupported level "${level}" for ${groupCode}`);
  }

  return {
    group_code: groupCode,
    level,
    grade,
    subject,
    display_name_en: String(group.display_name_en ?? "").trim(),
    display_name_zh_hant:
      String(group.display_name_zh_hant ?? group.display_name_en ?? "").trim(),
    locale: String(group.locale ?? localeDefault ?? "zh-Hant").trim() || "zh-Hant",
    is_active: true,
  };
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function main() {
  const taxonomy = loadTaxonomy();
  const localeDefault = taxonomy.locale_default || "zh-Hant";
  const curriculumGroups = Array.isArray(taxonomy.groups) ? taxonomy.groups : [];
  const fallbackGroups = Array.isArray(taxonomy.fallback_groups)
    ? taxonomy.fallback_groups
    : [];

  const rows = [];
  for (const group of curriculumGroups) {
    const row = mapCurriculumGroup(group, localeDefault);
    if (!row.display_name_en) {
      throw new Error(`display_name_en is required for ${row.group_code}`);
    }
    rows.push(row);
  }

  console.log("HK word group seed");
  console.log(`  taxonomy: ${TAXONOMY_PATH}`);
  console.log(`  curriculum groups: ${rows.length}`);
  console.log(`  fallback groups in taxonomy: ${fallbackGroups.length} (skipped — not in Phase 1 DB schema)`);

  if (fallbackGroups.length > 0) {
    for (const group of fallbackGroups) {
      console.log(
        `  skipped fallback: ${group.group_code} (${group.purpose || "fallback"})`,
      );
    }
  }

  if (isDryRun) {
    console.log("\nDry run — no database writes.");
    console.log("Sample rows:");
    for (const row of rows.slice(0, 3)) {
      console.log(`  - ${row.group_code} | ${row.display_name_en}`);
    }
    if (rows.length > 3) {
      console.log(`  ... and ${rows.length - 3} more`);
    }
    return;
  }

  const serviceClient = getAdminServiceClient();
  let upserted = 0;

  for (const batch of chunkArray(rows, 50)) {
    const { data, error } = await serviceClient
      .from("word_groups")
      .upsert(batch, { onConflict: "group_code" })
      .select("group_code");

    if (error) {
      throw new Error(error.message || "Failed to upsert word groups.");
    }

    upserted += (data ?? []).length;
  }

  const { count, error: countError } = await serviceClient
    .from("word_groups")
    .select("id", { count: "exact", head: true });

  if (countError) {
    throw new Error(countError.message || "Failed to count word groups.");
  }

  console.log(`\nUpserted ${upserted} curriculum group row(s).`);
  console.log(`Total rows in word_groups: ${count ?? "unknown"}`);
}

main().catch((error) => {
  console.error(`Seed failed: ${error.message || error}`);
  process.exit(1);
});
