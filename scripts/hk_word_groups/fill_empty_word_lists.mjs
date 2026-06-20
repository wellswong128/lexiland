#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, "../..");
const TAXONOMY_PATH = resolve(PROJECT_ROOT, "data/hk_word_groups/taxonomy.json");
const AGNES_API_URL = "https://apihub.agnes-ai.com/v1/chat/completions";
const DEFAULT_MODEL = "agnes-2.0-flash";
const DEFAULT_WORD_COUNT = 20;
const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_PAUSE_MS = 1200;

function parseArgs(argv) {
  const options = {
    count: DEFAULT_WORD_COUNT,
    dryRun: false,
    force: false,
    groupCode: "",
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    pauseMs: DEFAULT_PAUSE_MS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] ?? "");

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
      continue;
    }
    if (arg === "--count") {
      options.count = parsePositiveInt(argv[index + 1], DEFAULT_WORD_COUNT);
      index += 1;
      continue;
    }
    if (arg.startsWith("--count=")) {
      options.count = parsePositiveInt(arg.slice("--count=".length), DEFAULT_WORD_COUNT);
      continue;
    }
    if (arg === "--max-attempts") {
      options.maxAttempts = parsePositiveInt(argv[index + 1], DEFAULT_MAX_ATTEMPTS);
      index += 1;
      continue;
    }
    if (arg.startsWith("--max-attempts=")) {
      options.maxAttempts = parsePositiveInt(arg.slice("--max-attempts=".length), DEFAULT_MAX_ATTEMPTS);
      continue;
    }
    if (arg === "--pause-ms") {
      options.pauseMs = parsePositiveInt(argv[index + 1], DEFAULT_PAUSE_MS);
      index += 1;
      continue;
    }
    if (arg.startsWith("--pause-ms=")) {
      options.pauseMs = parsePositiveInt(arg.slice("--pause-ms=".length), DEFAULT_PAUSE_MS);
    }
  }

  return options;
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function gradeLower(grade) {
  return normalizeLower(grade);
}

function pause(ms) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

function readEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  const env = {};
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }

  return env;
}

function loadRuntimeEnv() {
  const fromDotEnv = readEnvFile(resolve(PROJECT_ROOT, ".env"));
  const fromLocal = readEnvFile(resolve(PROJECT_ROOT, ".env.local"));
  return {
    ...fromDotEnv,
    ...fromLocal,
    ...process.env,
  };
}

function loadTaxonomy() {
  return JSON.parse(readFileSync(TAXONOMY_PATH, "utf8"));
}

function selectTargetGroups(taxonomy, groupCodeFilter) {
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

function loadGroupFile(relativePath) {
  const absolutePath = resolve(PROJECT_ROOT, relativePath);
  const payload = JSON.parse(readFileSync(absolutePath, "utf8"));
  return { absolutePath, payload };
}

function toCleanWord(rawWord, group) {
  const term = normalizeText(rawWord.term);
  const definition = normalizeText(rawWord.definition);
  const translation = normalizeText(rawWord.translation);
  const example = normalizeText(rawWord.example);
  const exampleTranslation = normalizeText(
    rawWord.example_translation ?? rawWord.exampleTranslation,
  );

  if (!term || !definition || !translation || !example || !exampleTranslation) {
    return null;
  }

  const sourceTags = Array.isArray(rawWord.tags) ? rawWord.tags : [];
  const safeTags = sourceTags
    .map((tag) => normalizeLower(tag))
    .filter(Boolean)
    .slice(0, 5);

  const requiredTags = [
    "hk",
    normalizeLower(group.level),
    gradeLower(group.grade),
    normalizeLower(group.subject),
  ];

  const mergedTags = [...new Set([...requiredTags, ...safeTags])];

  return {
    term,
    definition,
    translation,
    example,
    example_translation: exampleTranslation,
    tags: mergedTags,
  };
}

function parseWordListFromAi(rawContent, group) {
  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    return [];
  }

  const list = Array.isArray(parsed?.words) ? parsed.words : [];
  const unique = new Map();

  for (const candidate of list) {
    const normalized = toCleanWord(candidate, group);
    if (!normalized) {
      continue;
    }
    const key = normalizeLower(normalized.term);
    if (!key || unique.has(key)) {
      continue;
    }
    unique.set(key, normalized);
  }

  return Array.from(unique.values());
}

function buildPrompt({ group, targetCount, existingTerms, attempt }) {
  const level = normalizeLower(group.level);
  const grade = normalizeText(group.grade);
  const subject = normalizeLower(group.subject);
  const displayName = normalizeText(group.display_name_en || group.group_code);
  const avoidTerms = existingTerms.slice(0, 250).join(", ");

  return `
You are preparing a Hong Kong curriculum vocabulary list.

Target group:
- level: ${level}
- grade: ${grade}
- subject: ${subject}
- label: ${displayName}

Task:
Generate ${targetCount} unique, grade-appropriate English vocabulary entries for this exact subject and grade.
All content must be child-safe, school-appropriate, and aligned to Hong Kong school usage.
Try to include a range of nouns, verbs, adjectives, and useful collocations where appropriate.

Rules:
1) Output valid JSON only.
2) Output shape:
{
  "words": [
    {
      "term": "...",
      "definition": "...",
      "translation": "...",
      "example": "...",
      "example_translation": "...",
      "tags": ["..."]
    }
  ]
}
3) translation and example_translation must be Traditional Chinese (zh-Hant).
4) term must be concise and practical for ${grade} ${subject}.
5) Keep definitions simple and student-friendly.
6) tags should include useful learning tags (topic/skill), no long sentences.
7) Do not include duplicate terms.
8) Avoid these existing terms: ${avoidTerms || "(none)"}

This is generation attempt ${attempt}.
`.trim();
}

async function requestAiWordBatch({
  apiKey,
  model,
  group,
  targetCount,
  existingTerms,
  attempt,
}) {
  const response = await fetch(AGNES_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an expert HK curriculum vocabulary planner. Always return strict JSON matching the requested schema.",
        },
        {
          role: "user",
          content: buildPrompt({ group, targetCount, existingTerms, attempt }),
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.error || `AI request failed (${response.status})`;
    throw new Error(String(message));
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI response did not include content.");
  }

  return parseWordListFromAi(content, group);
}

function mergeWords(existingWords, incomingWords, limit) {
  const merged = new Map();
  for (const word of existingWords) {
    const key = normalizeLower(word.term);
    if (key) {
      merged.set(key, word);
    }
  }
  for (const word of incomingWords) {
    const key = normalizeLower(word.term);
    if (!key || merged.has(key)) {
      continue;
    }
    merged.set(key, word);
    if (merged.size >= limit) {
      break;
    }
  }
  return Array.from(merged.values()).slice(0, limit);
}

async function fillGroupFile({
  group,
  options,
  apiKey,
  model,
}) {
  const { payload, absolutePath } = loadGroupFile(group.word_list_file);
  const existingWords = Array.isArray(payload.words) ? payload.words : [];
  if (existingWords.length > 0 && !options.force) {
    return { status: "skipped", count: existingWords.length, path: group.word_list_file };
  }

  const existingTerms = existingWords.map((word) => normalizeLower(word.term)).filter(Boolean);
  let mergedWords = [...existingWords];
  const errors = [];

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    if (mergedWords.length >= options.count) {
      break;
    }
    const missingCount = options.count - mergedWords.length;
    try {
      const generated = await requestAiWordBatch({
        apiKey,
        model,
        group,
        targetCount: Math.max(missingCount, 8),
        existingTerms: [...existingTerms, ...mergedWords.map((word) => normalizeLower(word.term))],
        attempt,
      });
      mergedWords = mergeWords(mergedWords, generated, options.count);
    } catch (error) {
      errors.push(error.message || String(error));
    }

    if (options.pauseMs > 0) {
      await pause(options.pauseMs);
    }
  }

  if (mergedWords.length === 0) {
    throw new Error(
      `Could not generate words for ${group.group_code}. ${errors.length > 0 ? errors.at(-1) : ""}`.trim(),
    );
  }

  const nextPayload = {
    ...payload,
    group_code: normalizeLower(payload.group_code || group.group_code),
    level: normalizeLower(payload.level || group.level),
    grade: normalizeText(payload.grade || group.grade).toUpperCase(),
    subject: normalizeLower(payload.subject || group.subject),
    locale: normalizeText(payload.locale || "zh-Hant"),
    version: normalizeText(payload.version || "2026.06"),
    display_name_en: normalizeText(payload.display_name_en || group.display_name_en),
    display_name_zh_hant: normalizeText(payload.display_name_zh_hant || group.display_name_zh_hant),
    words: mergedWords,
  };

  if (!options.dryRun) {
    writeFileSync(absolutePath, `${JSON.stringify(nextPayload, null, 2)}\n`, "utf8");
  }

  return {
    status: existingWords.length > 0 ? "updated" : "created",
    count: mergedWords.length,
    path: group.word_list_file,
    errors,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const env = loadRuntimeEnv();
  const apiKey = normalizeText(env.AGNES_API_KEY);
  const model = normalizeText(env.AGNES_MODEL || DEFAULT_MODEL);

  if (!apiKey) {
    throw new Error("AGNES_API_KEY is required in .env.local to auto-generate word lists.");
  }

  const taxonomy = loadTaxonomy();
  const groups = selectTargetGroups(taxonomy, options.groupCode);
  const summary = {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };

  console.log("HK word list auto-fill");
  console.log(`  groups: ${groups.length}`);
  console.log(`  words per file: ${options.count}`);
  console.log(`  model: ${model}`);
  console.log(`  mode: ${options.dryRun ? "dry-run" : "write"}${options.force ? " (force)" : ""}`);

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    const prefix = `[${index + 1}/${groups.length}] ${group.group_code}`;
    try {
      const result = await fillGroupFile({
        group,
        options,
        apiKey,
        model,
      });
      summary[result.status] += 1;
      console.log(`${prefix} -> ${result.status} (${result.count} words)`);
    } catch (error) {
      summary.failed += 1;
      console.log(`${prefix} -> failed (${error.message || error})`);
    }
  }

  console.log("\nAuto-fill summary");
  console.log(`  created: ${summary.created}`);
  console.log(`  updated: ${summary.updated}`);
  console.log(`  skipped: ${summary.skipped}`);
  console.log(`  failed: ${summary.failed}`);
}

main().catch((error) => {
  console.error(`Auto-fill failed: ${error.message || error}`);
  process.exit(1);
});
