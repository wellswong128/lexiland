#!/usr/bin/env node

/**
 * Import wordbase_group_map rows from per-group word list JSON files.
 *
 * Word list paths come from taxonomy.json (`word_list_file` on each group).
 * Each term is matched to wordbase by term_key (trim + lowercase).
 *
 * Prerequisite: run `npm run word-groups:seed` so word_groups rows exist.
 *
 * Env (service role): VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Usage:
 *   npm run word-groups:import-maps:dry-run
 *   npm run word-groups:import-maps
 *   npm run word-groups:import-maps -- --group-code hk-primary-p1-english
 *   npm run word-groups:import-maps -- --file data/hk_word_groups/primary/p1/english.json
 *   npm run word-groups:import-maps -- --strict
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAdminServiceClient } from "../../api/_admin-supabase.js";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, "../..");
const TAXONOMY_PATH = resolve(PROJECT_ROOT, "data/hk_word_groups/taxonomy.json");
const CONTRACT_PATH = resolve(PROJECT_ROOT, "data/hk_word_groups/DATA_CONTRACT.json");

const REQUIRED_FILE_FIELDS = [
  "group_code",
  "level",
  "grade",
  "subject",
  "locale",
  "version",
  "words",
];

function parseArgs(argv) {
  const options = {
    dryRun: false,
    strict: false,
    groupCode: "",
    filePath: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--strict") {
      options.strict = true;
      continue;
    }

    if (arg === "--group-code") {
      options.groupCode = normalizeLower(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith("--group-code=")) {
      options.groupCode = normalizeLower(arg.slice("--group-code=".length));
      continue;
    }

    if (arg === "--file") {
      options.filePath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg.startsWith("--file=")) {
      options.filePath = arg.slice("--file=".length);
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

function normalizeTerm(value) {
  return String(value ?? "").trim().toLowerCase();
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function resolveProjectPath(relativePath) {
  return resolve(PROJECT_ROOT, relativePath);
}

function loadTaxonomy() {
  return loadJson(TAXONOMY_PATH);
}

function buildGroupCode(level, grade, subject) {
  return `hk-${normalizeLower(level)}-${normalizeLower(grade)}-${normalizeLower(subject)}`;
}

function selectGroups(taxonomy, options) {
  const groups = Array.isArray(taxonomy.groups) ? taxonomy.groups : [];

  if (options.filePath) {
    const absolutePath = resolveProjectPath(options.filePath);
    if (!existsSync(absolutePath)) {
      throw new Error(`Word list file not found: ${absolutePath}`);
    }

    const payload = loadJson(absolutePath);
    const groupCode = normalizeLower(payload.group_code);
    const taxonomyGroup = groups.find((group) => normalizeLower(group.group_code) === groupCode);

    return [
      {
        group_code: groupCode,
        level: normalizeLower(payload.level ?? taxonomyGroup?.level),
        grade: normalizeUpper(payload.grade ?? taxonomyGroup?.grade),
        subject: normalizeLower(payload.subject ?? taxonomyGroup?.subject),
        word_list_file: options.filePath,
        absolute_path: absolutePath,
      },
    ];
  }

  let selected = groups.filter((group) => Boolean(group.word_list_file));

  if (options.groupCode) {
    selected = selected.filter(
      (group) => normalizeLower(group.group_code) === options.groupCode,
    );

    if (selected.length === 0) {
      throw new Error(`No taxonomy group found for group_code ${options.groupCode}.`);
    }
  }

  return selected.map((group) => ({
    ...group,
    group_code: normalizeLower(group.group_code),
    absolute_path: resolveProjectPath(group.word_list_file),
  }));
}

function validateWordListPayload(payload, expectedGroup) {
  for (const field of REQUIRED_FILE_FIELDS) {
    if (!(field in payload)) {
      throw new Error(`word list missing required field "${field}".`);
    }
  }

  if (!Array.isArray(payload.words)) {
    throw new Error("word list field \"words\" must be an array.");
  }

  const groupCode = normalizeLower(payload.group_code);
  const expectedCode = normalizeLower(expectedGroup.group_code);

  if (groupCode !== expectedCode) {
    throw new Error(
      `word list group_code "${groupCode}" does not match expected "${expectedCode}".`,
    );
  }

  const terms = [];
  const seen = new Set();

  for (const [index, word] of payload.words.entries()) {
    const term = normalizeTerm(typeof word === "string" ? word : word?.term);
    if (!term) {
      throw new Error(`words[${index}] is missing a valid term.`);
    }

    if (!seen.has(term)) {
      seen.add(term);
      terms.push(term);
    }
  }

  return {
    groupCode,
    terms,
    version: String(payload.version ?? "").trim(),
    locale: String(payload.locale ?? "").trim(),
    wordCount: payload.words.length,
    uniqueTermCount: terms.length,
  };
}

async function loadGroupIdMap(serviceClient, groupCodes) {
  const uniqueCodes = [...new Set(groupCodes.filter(Boolean))];
  const byCode = new Map();

  for (const batch of chunkArray(uniqueCodes, 100)) {
    const { data, error } = await serviceClient
      .from("word_groups")
      .select("id,group_code")
      .in("group_code", batch);

    if (error) {
      throw new Error(error.message || "Failed to load word_groups.");
    }

    for (const row of data ?? []) {
      byCode.set(normalizeLower(row.group_code), row.id);
    }
  }

  return byCode;
}

async function loadWordbaseIdMap(serviceClient, termKeys) {
  const byTermKey = new Map();

  for (const batch of chunkArray(termKeys, 100)) {
    const { data, error } = await serviceClient
      .from("wordbase")
      .select("id,term_key")
      .in("term_key", batch);

    if (error) {
      throw new Error(error.message || "Failed to load wordbase rows.");
    }

    for (const row of data ?? []) {
      byTermKey.set(normalizeTerm(row.term_key), row.id);
    }
  }

  return byTermKey;
}

async function upsertMappings(serviceClient, rows) {
  let upserted = 0;

  for (const batch of chunkArray(rows, 100)) {
    const { data, error } = await serviceClient
      .from("wordbase_group_map")
      .upsert(batch, { onConflict: "wordbase_id,group_id" })
      .select("id");

    if (error) {
      throw new Error(error.message || "Failed to upsert wordbase_group_map.");
    }

    upserted += (data ?? []).length;
  }

  return upserted;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const taxonomy = loadTaxonomy();
  const contract = existsSync(CONTRACT_PATH) ? loadJson(CONTRACT_PATH) : null;
  const selectedGroups = selectGroups(taxonomy, options);

  console.log("HK word group map import");
  console.log(`  taxonomy: ${TAXONOMY_PATH}`);
  if (contract?.word_list_file?.required_fields) {
    console.log(
      `  contract required fields: ${contract.word_list_file.required_fields.join(", ")}`,
    );
  }
  console.log(`  groups selected: ${selectedGroups.length}`);
  console.log(`  mode: ${options.dryRun ? "dry-run" : "write"}${options.strict ? " (strict)" : ""}`);

  const summary = {
    filesProcessed: 0,
    filesMissing: 0,
    filesFailed: 0,
    termsSeen: 0,
    termsMapped: 0,
    termsMissing: 0,
    mappingsUpserted: 0,
  };

  const pendingImports = [];

  for (const group of selectedGroups) {
    const filePath = group.absolute_path;
    const groupCode = normalizeLower(group.group_code);

    if (!existsSync(filePath)) {
      summary.filesMissing += 1;
      console.log(`  missing file: ${group.word_list_file} (${groupCode})`);
      continue;
    }

    try {
      const payload = loadJson(filePath);
      const parsed = validateWordListPayload(payload, group);
      summary.filesProcessed += 1;
      summary.termsSeen += parsed.uniqueTermCount;

      pendingImports.push({
        groupCode,
        filePath: group.word_list_file,
        ...parsed,
      });

      console.log(
        `  loaded ${group.word_list_file}: ${parsed.uniqueTermCount} unique term(s)`,
      );
    } catch (error) {
      summary.filesFailed += 1;
      console.error(`  invalid file ${group.word_list_file}: ${error.message}`);
      if (options.strict) {
        process.exit(1);
      }
    }
  }

  if (pendingImports.length === 0) {
    console.log("\nNo word list files to import.");
    if (summary.filesMissing > 0) {
      console.log(
        "Create JSON files under data/hk_word_groups/... (paths are listed in taxonomy.json).",
      );
    }
    return;
  }

  if (options.dryRun) {
    console.log("\nDry run — no database writes.");
    for (const item of pendingImports) {
      console.log(
        `  would map ${item.uniqueTermCount} term(s) -> ${item.groupCode} (${item.filePath})`,
      );
    }
    return;
  }

  const serviceClient = getAdminServiceClient();
  const groupIdMap = await loadGroupIdMap(
    serviceClient,
    pendingImports.map((item) => item.groupCode),
  );

  for (const item of pendingImports) {
    const groupId = groupIdMap.get(item.groupCode);
    if (!groupId) {
      const message = `word_groups row not found for ${item.groupCode}. Run npm run word-groups:seed first.`;
      console.error(`  ${message}`);
      if (options.strict) {
        process.exit(1);
      }
      summary.filesFailed += 1;
      continue;
    }

    const wordbaseIdMap = await loadWordbaseIdMap(serviceClient, item.terms);
    const mappingRows = [];
    const missingTerms = [];

    for (const termKey of item.terms) {
      const wordbaseId = wordbaseIdMap.get(termKey);
      if (!wordbaseId) {
        missingTerms.push(termKey);
        continue;
      }

      mappingRows.push({
        group_id: groupId,
        wordbase_id: wordbaseId,
      });
    }

    summary.termsMissing += missingTerms.length;
    summary.termsMapped += mappingRows.length;

    if (missingTerms.length > 0) {
      const preview = missingTerms.slice(0, 8).join(", ");
      const suffix =
        missingTerms.length > 8 ? ` ... +${missingTerms.length - 8} more` : "";
      console.log(
        `  ${item.groupCode}: ${missingTerms.length} term(s) not in wordbase (${preview}${suffix})`,
      );
    }

    if (mappingRows.length === 0) {
      console.log(`  ${item.groupCode}: no mappings created`);
      continue;
    }

    const upserted = await upsertMappings(serviceClient, mappingRows);
    summary.mappingsUpserted += upserted;
    console.log(`  ${item.groupCode}: upserted ${upserted} mapping(s)`);
  }

  console.log("\nImport summary");
  console.log(`  files processed: ${summary.filesProcessed}`);
  console.log(`  files missing: ${summary.filesMissing}`);
  console.log(`  files failed: ${summary.filesFailed}`);
  console.log(`  unique terms seen: ${summary.termsSeen}`);
  console.log(`  terms mapped: ${summary.termsMapped}`);
  console.log(`  terms missing from wordbase: ${summary.termsMissing}`);
  console.log(`  mappings upserted: ${summary.mappingsUpserted}`);

  if (options.strict && summary.termsMissing > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`Import failed: ${error.message || error}`);
  process.exit(1);
});
