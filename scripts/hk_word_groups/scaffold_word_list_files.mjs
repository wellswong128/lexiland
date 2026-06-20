#!/usr/bin/env node

/**
 * Scaffold empty word list JSON files from taxonomy.json word_list_file paths.
 *
 * Skips files that already exist unless --force is passed.
 *
 * Usage:
 *   npm run word-groups:scaffold-lists:dry-run
 *   npm run word-groups:scaffold-lists
 *   npm run word-groups:scaffold-lists -- --group-code hk-primary-p1-english
 *   npm run word-groups:scaffold-lists -- --force
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, "../..");
const TAXONOMY_PATH = resolve(PROJECT_ROOT, "data/hk_word_groups/taxonomy.json");

function parseArgs(argv) {
  const options = {
    dryRun: false,
    force: false,
    groupCode: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--force") {
      options.force = true;
      continue;
    }

    if (arg === "--group-code") {
      options.groupCode = normalizeLower(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith("--group-code=")) {
      options.groupCode = normalizeLower(arg.slice("--group-code=".length));
    }
  }

  return options;
}

function normalizeLower(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeUpper(value) {
  return String(value ?? "").trim().toUpperCase();
}

function loadTaxonomy() {
  return JSON.parse(readFileSync(TAXONOMY_PATH, "utf8"));
}

function buildTemplate(group, taxonomy) {
  return {
    group_code: normalizeLower(group.group_code),
    level: normalizeLower(group.level),
    grade: normalizeUpper(group.grade),
    subject: normalizeLower(group.subject),
    locale: taxonomy.locale_default || "zh-Hant",
    version: taxonomy.version || "2026.06",
    display_name_en: String(group.display_name_en ?? "").trim(),
    display_name_zh_hant: String(group.display_name_zh_hant ?? "").trim(),
    words: [],
  };
}

function selectGroups(taxonomy, groupCodeFilter) {
  const groups = Array.isArray(taxonomy.groups) ? taxonomy.groups : [];
  let selected = groups.filter((group) => Boolean(group.word_list_file));

  if (groupCodeFilter) {
    selected = selected.filter(
      (group) => normalizeLower(group.group_code) === groupCodeFilter,
    );

    if (selected.length === 0) {
      throw new Error(`No taxonomy group found for group_code ${groupCodeFilter}.`);
    }
  }

  return selected;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const taxonomy = loadTaxonomy();
  const groups = selectGroups(taxonomy, options.groupCode);

  console.log("HK word list scaffold");
  console.log(`  taxonomy: ${TAXONOMY_PATH}`);
  console.log(`  groups: ${groups.length}`);
  console.log(`  mode: ${options.dryRun ? "dry-run" : "write"}${options.force ? " (force)" : ""}`);

  const summary = {
    created: 0,
    skipped: 0,
    overwritten: 0,
  };

  for (const group of groups) {
    const relativePath = group.word_list_file;
    const absolutePath = resolve(PROJECT_ROOT, relativePath);
    const exists = existsSync(absolutePath);

    if (exists && !options.force) {
      summary.skipped += 1;
      continue;
    }

    const template = buildTemplate(group, taxonomy);
    const content = `${JSON.stringify(template, null, 2)}\n`;

    if (options.dryRun) {
      console.log(`  would write: ${relativePath}`);
      summary.created += 1;
      continue;
    }

    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content, "utf8");

    if (exists) {
      summary.overwritten += 1;
      console.log(`  overwritten: ${relativePath}`);
    } else {
      summary.created += 1;
      console.log(`  created: ${relativePath}`);
    }
  }

  console.log("\nScaffold summary");
  console.log(`  created: ${summary.created}`);
  console.log(`  skipped (already exist): ${summary.skipped}`);
  console.log(`  overwritten: ${summary.overwritten}`);
}

main().catch((error) => {
  console.error(`Scaffold failed: ${error.message || error}`);
  process.exit(1);
});
