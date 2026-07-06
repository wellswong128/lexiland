import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { requireRole, sendAuthError } from "../_authz.js";
import { getRequestBody } from "../_request-body.js";
import { generateCompleteWordSuggestion } from "../_complete-word-suggestion.js";
import {
  hasContentMemoryTips,
  hasMemoryImage,
  mapWordbaseRow,
} from "../../../src/lib/wordbaseCompleteness.js";
import { generateWordMemoryImage } from "./word-memory-image.js";
import { requestMemoryTips } from "./word-memory-tips.js";

const URL_ENV_KEYS = [
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "PUBLIC_SUPABASE_URL",
];
const SERVICE_KEY_ENV_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE",
  "SUPABASE_SERVICE_KEY",
  "SERVICE_ROLE_KEY",
  "VITE_SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
  "PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_SECRET_KEY",
  "PUBLIC_SUPABASE_SECRET_KEY",
];
const NODE_ENV = String(process.env.NODE_ENV || "development").trim() || "development";
const ENV_FILES = [
  `.env.${NODE_ENV}.local`,
  ".env.local",
  `.env.${NODE_ENV}`,
  ".env",
];
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const WORD_COLUMNS = [
  "id",
  "term_key",
  "term",
  "definition",
  "translation",
  "pronunciation",
  "part_of_speech",
  "example",
  "example_translation",
  "memory_tips_by_locale",
  "memory_image",
  "source",
  "updated_at",
];
const MISSING_FIELD_CONFIG = [
  { key: "definition", column: "definition" },
  { key: "translation", column: "translation" },
  { key: "example", column: "example" },
  { key: "exampleTranslation", column: "example_translation" },
];
const CONTENT_TIP_LOCALES = ["zh-Hant", "zh-Hans"];
const LIST_PAGE_SIZE = 500;
const LIST_SCAN_LIMIT = 10000;

let localEnvLoaded = false;

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

function parseDotEnv(content) {
  const parsed = {};
  const lines = content.split(/\r?\n/u);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalIndex = trimmed.indexOf("=");
    if (equalIndex < 0) {
      continue;
    }

    const rawKey = trimmed
      .slice(0, equalIndex)
      .trim()
      .replace(/^export\s+/u, "");
    if (!rawKey) {
      continue;
    }

    let value = trimmed.slice(equalIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[rawKey] = value;
  }

  return parsed;
}

function loadLocalEnvIfNeeded() {
  if (localEnvLoaded) {
    return;
  }

  localEnvLoaded = true;

  for (const relativePath of ENV_FILES) {
    const absolutePath = resolve(PROJECT_ROOT, relativePath);
    if (!existsSync(absolutePath)) {
      continue;
    }

    const parsed = parseDotEnv(readFileSync(absolutePath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof process.env[key] === "undefined" && value) {
        process.env[key] = value;
      }
    }
  }
}

function readFirstEnvValue(keys) {
  for (const key of keys) {
    const value = String(process.env[key] || "").trim();
    if (value) {
      return { key, value };
    }
  }

  return { key: "", value: "" };
}

function getServiceClient() {
  loadLocalEnvIfNeeded();

  const { key: urlKey, value: supabaseUrl } = readFirstEnvValue(URL_ENV_KEYS);
  const { key: serviceKeyName, value: serviceRoleKey } =
    readFirstEnvValue(SERVICE_KEY_ENV_KEYS);

  if (!supabaseUrl || !serviceRoleKey) {
    const visible = {
      url: urlKey || "(missing)",
      serviceKey: serviceKeyName || "(missing)",
    };
    throw new Error(
      `Supabase admin env is missing. Expected one of URL keys ${URL_ENV_KEYS.join(
        ", ",
      )} and service key ${SERVICE_KEY_ENV_KEYS.join(
        ", ",
      )}. Detected: url=${visible.url}, serviceKey=${visible.serviceKey}.`,
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

function normalizeTerm(value) {
  return String(value ?? "").trim().toLowerCase();
}

function buildTextMissingOrFilter() {
  return MISSING_FIELD_CONFIG.map(({ column }) => `${column}.eq.`).join(",");
}

function buildWordbaseListQuery(serviceClient, { search }) {
  let query = serviceClient
    .from("wordbase")
    .select(WORD_COLUMNS.join(","))
    .order("term_key", { ascending: true });

  if (search) {
    query = query.or(`term.ilike.%${search}%,term_key.ilike.%${normalizeTerm(search)}%`);
  }

  return query;
}

function matchesSearch(row, search) {
  if (!search) {
    return true;
  }

  const query = normalizeTerm(search);
  return (
    normalizeTerm(row?.term).includes(query) || normalizeTerm(row?.term_key).includes(query)
  );
}

function mergeMappedRows(targetById, rows, locale, { requireMissingFields = true, search = "" } = {}) {
  for (const row of rows ?? []) {
    if (!matchesSearch(row, search)) {
      continue;
    }

    const mappedRow = mapWordbaseRow(row, locale);
    if (requireMissingFields && mappedRow.missingFields.length === 0) {
      continue;
    }

    targetById.set(mappedRow.id, mappedRow);
  }
}

async function fetchWordbaseRowsByScan(serviceClient, { search, limit, locale }) {
  const filteredRows = [];
  let start = 0;

  while (filteredRows.length < limit && start < LIST_SCAN_LIMIT) {
    const { data, error } = await buildWordbaseListQuery(serviceClient, { search }).range(
      start,
      start + LIST_PAGE_SIZE - 1,
    );

    if (error) {
      throw new Error(error.message || "Failed to load wordbase rows.");
    }

    const batch = data ?? [];
    if (batch.length === 0) {
      break;
    }

    for (const row of batch) {
      const mappedRow = mapWordbaseRow(row, locale);
      if (mappedRow.missingFields.length > 0) {
        filteredRows.push(mappedRow);
        if (filteredRows.length >= limit) {
          break;
        }
      }
    }

    if (batch.length < LIST_PAGE_SIZE) {
      break;
    }

    start += LIST_PAGE_SIZE;
  }

  return filteredRows;
}

async function fetchTextMissingRows(serviceClient, { limit }) {
  const { data, error } = await serviceClient
    .from("wordbase")
    .select(WORD_COLUMNS.join(","))
    .or(buildTextMissingOrFilter())
    .order("term_key", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message || "Failed to load text-missing wordbase rows.");
  }

  return data ?? [];
}

async function fetchNullImageRows(serviceClient, { limit }) {
  const { data, error } = await serviceClient
    .from("wordbase")
    .select(WORD_COLUMNS.join(","))
    .is("memory_image", null)
    .order("term_key", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message || "Failed to load image-missing wordbase rows.");
  }

  return data ?? [];
}

async function fetchIncompleteWordbaseRows(serviceClient, { search, limit, locale }) {
  const rowsById = new Map();
  const sources = [];
  let rpcError = null;

  const { data: rpcRows, error: rpcQueryError } = await serviceClient.rpc(
    "get_incomplete_wordbase_rows",
    {
      p_limit: limit,
      p_search: search || null,
    },
  );

  if (rpcQueryError) {
    rpcError = rpcQueryError.message || "RPC unavailable.";
  } else if (rpcRows?.length) {
    mergeMappedRows(rowsById, rpcRows, locale, { requireMissingFields: false, search });
    sources.push("rpc");
  }

  if (rowsById.size < limit) {
    const textRows = await fetchTextMissingRows(serviceClient, { limit });
    const before = rowsById.size;
    mergeMappedRows(rowsById, textRows, locale, { search });
    if (rowsById.size > before) {
      sources.push("text");
    }
  }

  if (rowsById.size < limit) {
    const nullImageRows = await fetchNullImageRows(serviceClient, { limit });
    const before = rowsById.size;
    mergeMappedRows(rowsById, nullImageRows, locale, { search });
    if (rowsById.size > before) {
      sources.push("nullImage");
    }
  }

  if (rowsById.size < limit) {
    const scannedRows = await fetchWordbaseRowsByScan(serviceClient, {
      search,
      limit,
      locale,
    });

    for (const row of scannedRows) {
      rowsById.set(row.id, row);
    }

    if (scannedRows.length > 0 && !sources.includes("scan")) {
      sources.push("scan");
    }
  }

  return {
    rows: [...rowsById.values()]
      .sort((left, right) => left.term.localeCompare(right.term))
      .slice(0, limit),
    meta: {
      sources,
      rpcError,
    },
  };
}

function parseBoolean(value, defaultValue = false) {
  if (typeof value === "boolean") {
    return value;
  }

  const lower = String(value ?? "").trim().toLowerCase();
  if (!lower) {
    return defaultValue;
  }

  return ["1", "true", "yes", "y"].includes(lower);
}

function parseLimit(value, defaultValue = 50) {
  const number = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(number) || number <= 0) {
    return defaultValue;
  }

  return Math.min(number, 200);
}

async function fetchWordbaseRows(serviceClient, { search, limit, missingOnly, locale }) {
  if (!missingOnly) {
    const { data, error } = await buildWordbaseListQuery(serviceClient, { search }).limit(limit);

    if (error) {
      throw new Error(error.message || "Failed to load wordbase rows.");
    }

    return {
      rows: (data ?? []).map((row) => mapWordbaseRow(row, locale)),
      meta: {
        sources: ["list"],
        rpcError: null,
      },
    };
  }

  return fetchIncompleteWordbaseRows(serviceClient, { search, limit, locale });
}

async function listWordbaseRows(request, response) {
  const serviceClient = getServiceClient();
  const search = String(request.query?.search ?? "").trim();
  const limit = parseLimit(request.query?.limit, 50);
  const missingOnly = parseBoolean(request.query?.missingOnly, true);
  const locale = String(request.query?.locale ?? "zh-Hant").trim() || "zh-Hant";

  const { rows, meta: fetchMeta } = await fetchWordbaseRows(serviceClient, {
    search,
    limit,
    missingOnly,
    locale,
  });

  sendJson(response, 200, {
    rows,
    meta: {
      limit,
      missingOnly,
      locale,
      total: rows.length,
      sources: fetchMeta.sources,
      rpcError: fetchMeta.rpcError,
    },
  });
}

function hasMissingTextFields(row) {
  return MISSING_FIELD_CONFIG.some(({ column }) => !String(row?.[column] ?? "").trim());
}

function buildAiPatch(existingRow, suggestion) {
  const patch = {};

  if (!String(existingRow.definition ?? "").trim() && suggestion.definition) {
    patch.definition = suggestion.definition;
  }
  if (!String(existingRow.translation ?? "").trim() && suggestion.translation) {
    patch.translation = suggestion.translation;
  }
  if (!String(existingRow.example ?? "").trim() && suggestion.example) {
    patch.example = suggestion.example;
  }
  if (!String(existingRow.example_translation ?? "").trim() && suggestion.exampleTranslation) {
    patch.example_translation = suggestion.exampleTranslation;
  }

  return patch;
}

function resolveMemoryTipLocale(locale) {
  if (locale === "zh-Hans" || locale === "zh-Hant") {
    return locale;
  }

  return "zh-Hant";
}

const ADMIN_REFILL_IMAGE_LIMITS = {
  maxGenerations: 1,
  maxTextChecks: 0,
  generationTimeoutMs: 30000,
};

async function buildMemoryTipsPatch(existingRow, locale) {
  const patch = {};
  const warnings = [];
  const apiKey = String(process.env.AGNES_API_KEY || "").trim();
  const wordContext = {
    term: existingRow.term,
    definition: existingRow.definition ?? "",
    translation: existingRow.translation ?? "",
    partOfSpeech: existingRow.part_of_speech ?? "",
    example: existingRow.example ?? "",
  };
  const tipLocale = resolveMemoryTipLocale(locale);

  if (!hasContentMemoryTips(existingRow)) {
    if (!apiKey) {
      warnings.push("AGNES_API_KEY is not configured on the server.");
    } else {
      try {
        const memoryTips = await requestMemoryTips(apiKey, wordContext, tipLocale);
        const existingTips =
          existingRow.memory_tips_by_locale && typeof existingRow.memory_tips_by_locale === "object"
            ? existingRow.memory_tips_by_locale
            : {};

        patch.memory_tips_by_locale = {
          ...existingTips,
          [tipLocale]: {
            ...memoryTips,
            savedAt: new Date().toISOString(),
          },
        };
      } catch (error) {
        warnings.push(error.message || "Could not generate memory tips.");
      }
    }
  }

  return { patch, warnings };
}

async function buildMemoryImagePatch(existingRow) {
  const patch = {};
  const warnings = [];
  const apiKey = String(process.env.AGNES_API_KEY || "").trim();
  const wordContext = {
    term: existingRow.term,
    definition: existingRow.definition ?? "",
    translation: existingRow.translation ?? "",
    example: existingRow.example ?? "",
  };

  if (!hasMemoryImage(existingRow)) {
    if (!apiKey) {
      warnings.push("AGNES_API_KEY is not configured on the server.");
    } else {
      try {
        const image = await generateWordMemoryImage({
          ...wordContext,
          apiKey,
          limits: ADMIN_REFILL_IMAGE_LIMITS,
        });

        patch.memory_image = {
          imageUrl: image.imageUrl,
          prompt: image.prompt ?? "",
          model: image.model ?? "",
          size: image.size ?? "",
          savedAt: new Date().toISOString(),
        };
      } catch (error) {
        warnings.push(error.message || "Could not generate memory image.");
      }
    }
  }

  return { patch, warnings };
}

async function applyWordbasePatch(serviceClient, rowId, patch) {
  if (Object.keys(patch).length === 0) {
    return null;
  }

  const { data, error } = await serviceClient
    .from("wordbase")
    .update({
      ...patch,
      source: "ai",
    })
    .eq("id", rowId)
    .select(WORD_COLUMNS.join(","))
    .single();

  if (error) {
    throw new Error(error.message || "Could not update WordBase row.");
  }

  return data;
}

async function deleteWordbaseRow(request, response) {
  const body = getRequestBody(request);
  const wordbaseId = String(body.wordbaseId ?? request.query?.wordbaseId ?? "").trim();
  const term = String(body.term ?? request.query?.term ?? "").trim();

  if (!wordbaseId && !term) {
    sendJson(response, 400, { error: "wordbaseId or term is required." });
    return;
  }

  const serviceClient = getServiceClient();
  let lookupQuery = serviceClient.from("wordbase").select("id, term").limit(1);
  if (wordbaseId) {
    lookupQuery = lookupQuery.eq("id", wordbaseId);
  } else {
    lookupQuery = lookupQuery.eq("term_key", normalizeTerm(term));
  }

  const { data: row, error: rowError } = await lookupQuery.maybeSingle();

  if (rowError) {
    throw new Error(rowError.message || "Could not read wordbase row.");
  }
  if (!row) {
    sendJson(response, 404, { error: "WordBase row not found." });
    return;
  }

  const { data: deletedRows, error: deleteError } = await serviceClient
    .from("wordbase")
    .delete()
    .eq("id", row.id)
    .select("id, term");

  if (deleteError) {
    throw new Error(deleteError.message || "Could not delete WordBase row.");
  }
  if (!deletedRows?.length) {
    sendJson(response, 404, { error: "WordBase row not found." });
    return;
  }

  sendJson(response, 200, {
    deleted: true,
    id: deletedRows[0].id,
    term: deletedRows[0].term ?? "",
  });
}

function getNextRefillStep(row, locale) {
  if (hasMissingTextFields(row)) {
    return "text";
  }

  const mappedRow = mapWordbaseRow(row, locale);
  if (mappedRow.missingFields.includes("memoryTips")) {
    return "tips";
  }
  if (mappedRow.missingFields.includes("memoryImage")) {
    return "image";
  }

  return null;
}

async function refillWordbaseRow(request, response) {
  const body = getRequestBody(request);
  const wordbaseId = String(body.wordbaseId ?? "").trim();
  const term = String(body.term ?? "").trim();
  const locale = String(body.locale ?? "zh-Hant").trim() || "zh-Hant";

  if (!wordbaseId && !term) {
    sendJson(response, 400, { error: "wordbaseId or term is required." });
    return;
  }

  const serviceClient = getServiceClient();
  let lookupQuery = serviceClient.from("wordbase").select(WORD_COLUMNS.join(",")).limit(1);
  if (wordbaseId) {
    lookupQuery = lookupQuery.eq("id", wordbaseId);
  } else {
    lookupQuery = lookupQuery.eq("term_key", normalizeTerm(term));
  }

  const { data: row, error: rowError } = await lookupQuery.maybeSingle();
  if (rowError) {
    throw new Error(rowError.message || "Could not read wordbase row.");
  }
  if (!row) {
    sendJson(response, 404, { error: "WordBase row not found." });
    return;
  }

  const step = getNextRefillStep(row, locale);
  if (!step) {
    sendJson(response, 200, {
      updated: false,
      row: mapWordbaseRow(row, locale),
      message: "No missing fields to fill.",
    });
    return;
  }

  const warnings = [];
  let patch = {};

  if (step === "text") {
    try {
      const suggestion = await generateCompleteWordSuggestion(row.term, locale);
      patch = buildAiPatch(row, suggestion);
    } catch (error) {
      throw new Error(error.message || "AI text fill failed.");
    }
  } else if (step === "tips") {
    const { patch: tipsPatch, warnings: tipWarnings } = await buildMemoryTipsPatch(row, locale);
    warnings.push(...tipWarnings);
    patch = tipsPatch;
  } else if (step === "image") {
    const { patch: imagePatch, warnings: imageWarnings } = await buildMemoryImagePatch(row);
    warnings.push(...imageWarnings);
    patch = imagePatch;
  }

  if (Object.keys(patch).length === 0) {
    sendJson(response, 200, {
      updated: false,
      step,
      partial: warnings.length > 0,
      warnings,
      row: mapWordbaseRow(row, locale),
      message: warnings[0] || "Could not fill missing fields.",
    });
    return;
  }

  const updatedRow = await applyWordbasePatch(serviceClient, row.id, patch);
  const mappedRow = mapWordbaseRow(updatedRow, locale);

  sendJson(response, 200, {
    updated: true,
    step,
    partial: mappedRow.missingFields.length > 0 || warnings.length > 0,
    warnings,
    remainingMissingFields: mappedRow.missingFields,
    row: mappedRow,
  });
}

export default async function handler(request, response) {
  try {
    await requireRole(request, ["owner", "admin"]);

    if (request.method === "GET") {
      await listWordbaseRows(request, response);
      return;
    }

    if (request.method === "POST") {
      const body = getRequestBody(request);
      if (String(body.action ?? "").trim().toLowerCase() === "delete") {
        await deleteWordbaseRow(request, response);
        return;
      }

      await refillWordbaseRow(request, response);
      return;
    }

    if (request.method === "DELETE") {
      await deleteWordbaseRow(request, response);
      return;
    }

    sendJson(response, 405, { error: "Method not allowed." });
  } catch (error) {
    if (error?.statusCode) {
      sendAuthError(response, error);
      return;
    }
    sendJson(response, 500, { error: error.message || "WordBase admin API failed." });
  }
}
