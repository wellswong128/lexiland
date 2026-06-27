#!/usr/bin/env node

/**
 * Merge curriculum-theme term lists into a word group JSON file.
 * Keeps existing entries that already have definitions; adds term-only rows for import.
 *
 * Usage:
 *   npm run word-groups:prepare:s1-mathematics
 *   node scripts/hk_word_groups/prepare_curriculum_word_list.mjs --preset hk-secondary-s1-mathematics
 *   node scripts/hk_word_groups/prepare_curriculum_word_list.mjs --preset hk-secondary-s1-mathematics --dry-run
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, "../..");
const TAXONOMY_PATH = resolve(PROJECT_ROOT, "data/hk_word_groups/taxonomy.json");
const THEMES_DIR = resolve(SCRIPT_DIR, "curriculum_themes");

function parseArgs(argv) {
  const options = {
    dryRun: false,
    preset: "",
    output: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] ?? "");

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--preset") {
      options.preset = normalizeLower(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith("--preset=")) {
      options.preset = normalizeLower(arg.slice("--preset=".length));
      continue;
    }
    if (arg === "--output") {
      options.output = String(argv[index + 1] ?? "").trim();
      index += 1;
      continue;
    }
    if (arg.startsWith("--output=")) {
      options.output = arg.slice("--output=".length).trim();
    }
  }

  return options;
}

function normalizeLower(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeTerm(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function loadTaxonomy() {
  return JSON.parse(readFileSync(TAXONOMY_PATH, "utf8"));
}

function findGroup(taxonomy, groupCode) {
  const match = taxonomy.groups.find((group) => normalizeLower(group.group_code) === groupCode);
  if (!match) {
    throw new Error(`Unknown group_code in taxonomy: ${groupCode}`);
  }
  return match;
}

function loadPreset(preset) {
  const presetPath = resolve(THEMES_DIR, `${preset}.json`);
  if (!existsSync(presetPath)) {
    throw new Error(`Preset not found: ${presetPath}`);
  }
  return JSON.parse(readFileSync(presetPath, "utf8"));
}

function loadWordList(outputPath) {
  if (!existsSync(outputPath)) {
    return null;
  }
  return JSON.parse(readFileSync(outputPath, "utf8"));
}

function baseTagsFromGroup(group) {
  return [
    "hk",
    normalizeLower(group.level),
    normalizeLower(group.grade),
    normalizeLower(group.subject),
  ];
}

function parseThemeTerms(rawTerms) {
  if (Array.isArray(rawTerms)) {
    return rawTerms.map(normalizeTerm).filter(Boolean);
  }
  return String(rawTerms ?? "")
    .split(/\s+/)
    .map(normalizeTerm)
    .filter(Boolean);
}

function buildTermOnlyEntry(term, baseTags, themeSlug) {
  return {
    term,
    tags: [...baseTags, "curriculum-style", themeSlug],
  };
}

function mergeCurriculumList({ group, preset, existingList }) {
  const baseTags = baseTagsFromGroup(group);
  const curated = (existingList?.words ?? []).filter((word) => Boolean(word.definition));
  const curatedTerms = new Set(curated.map((word) => normalizeLower(word.term)));

  const termOnly = [];
  const seen = new Set(curatedTerms);

  for (const [themeSlug, rawTerms] of Object.entries(preset.themes ?? {})) {
    for (const term of parseThemeTerms(rawTerms)) {
      const key = normalizeLower(term);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      termOnly.push(buildTermOnlyEntry(term, baseTags, themeSlug));
    }
  }

  termOnly.sort((left, right) => left.term.localeCompare(right.term, "en"));

  return {
    group_code: normalizeLower(group.group_code),
    level: normalizeLower(group.level),
    grade: String(group.grade ?? "").trim().toUpperCase(),
    subject: normalizeLower(group.subject),
    locale: existingList?.locale ?? "zh-Hant",
    version: existingList?.version ?? "2026.06",
    display_name_en: String(group.display_name_en ?? existingList?.display_name_en ?? "").trim(),
    display_name_zh_hant: String(
      group.display_name_zh_hant ?? existingList?.display_name_zh_hant ?? "",
    ).trim(),
    source: preset.source,
    words: [...curated, ...termOnly],
  };
}

function summarize(list) {
  const themeCounts = {};
  for (const word of list.words) {
    if (word.definition) {
      continue;
    }
    const themeTag = (word.tags ?? []).find((tag) => tag !== "curriculum-style" && !["hk", "secondary", "primary", "s1", "s2", "s3", "s4", "s5", "s6", "p1", "p2", "p3", "p4", "p5", "p6", "english", "mathematics"].includes(tag));
    if (themeTag) {
      themeCounts[themeTag] = (themeCounts[themeTag] ?? 0) + 1;
    }
  }

  return {
    total: list.words.length,
    curated: list.words.filter((word) => word.definition).length,
    termOnly: list.words.filter((word) => !word.definition).length,
    themes: Object.keys(themeCounts).length,
    themeCounts,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.preset) {
    throw new Error("Missing required --preset (e.g. hk-secondary-s1-mathematics)");
  }

  const preset = loadPreset(options.preset);
  const groupCode = normalizeLower(preset.group_code ?? options.preset);
  const taxonomy = loadTaxonomy();
  const group = findGroup(taxonomy, groupCode);
  const outputPath = resolve(
    PROJECT_ROOT,
    options.output || group.word_list_file || `data/hk_word_groups/${group.level}/${group.grade.toLowerCase()}/${group.subject}.json`,
  );

  const existingList = loadWordList(outputPath);
  const merged = mergeCurriculumList({ group, preset, existingList });
  const stats = summarize(merged);

  console.log(`Preset: ${options.preset}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Words: ${stats.total} (${stats.curated} curated + ${stats.termOnly} term-only)`);
  console.log(`Themes: ${stats.themes}`);
  for (const [theme, count] of Object.entries(stats.themeCounts).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  - ${theme}: ${count}`);
  }

  if (options.dryRun) {
    console.log("Dry run — no file written.");
    return;
  }

  writeFileSync(outputPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  console.log("Wrote curriculum-style word list.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
