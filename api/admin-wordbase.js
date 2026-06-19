import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { requireRole, sendAuthError } from "./_authz.js";
import { generateCompleteWordSuggestion } from "./_complete-word-suggestion.js";

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
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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
  "source",
  "updated_at",
];
const MISSING_FIELD_CONFIG = [
  { key: "definition", column: "definition" },
  { key: "translation", column: "translation" },
  { key: "pronunciation", column: "pronunciation" },
  { key: "partOfSpeech", column: "part_of_speech" },
  { key: "example", column: "example" },
  { key: "exampleTranslation", column: "example_translation" },
];

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

function missingFieldsForRow(row) {
  return MISSING_FIELD_CONFIG.filter(({ column }) => !String(row?.[column] ?? "").trim()).map(
    ({ key }) => key,
  );
}

function mapWordbaseRow(row) {
  return {
    id: row.id,
    termKey: row.term_key,
    term: row.term,
    definition: row.definition ?? "",
    translation: row.translation ?? "",
    pronunciation: row.pronunciation ?? "",
    partOfSpeech: row.part_of_speech ?? "",
    example: row.example ?? "",
    exampleTranslation: row.example_translation ?? "",
    source: row.source ?? "",
    updatedAt: row.updated_at ?? "",
    missingFields: missingFieldsForRow(row),
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

async function listWordbaseRows(request, response) {
  const serviceClient = getServiceClient();
  const search = String(request.query?.search ?? "").trim();
  const limit = parseLimit(request.query?.limit, 50);
  const missingOnly = parseBoolean(request.query?.missingOnly, true);

  let query = serviceClient
    .from("wordbase")
    .select(WORD_COLUMNS.join(","))
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (search) {
    query = query.or(`term.ilike.%${search}%,term_key.ilike.%${normalizeTerm(search)}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || "Failed to load wordbase rows.");
  }

  const rows = (data ?? []).map(mapWordbaseRow);
  const filteredRows = missingOnly
    ? rows.filter((row) => row.missingFields.length > 0)
    : rows;

  sendJson(response, 200, {
    rows: filteredRows,
    meta: {
      limit,
      missingOnly,
      total: filteredRows.length,
    },
  });
}

function buildAiPatch(existingRow, suggestion) {
  const patch = {};

  if (!String(existingRow.definition ?? "").trim() && suggestion.definition) {
    patch.definition = suggestion.definition;
  }
  if (!String(existingRow.translation ?? "").trim() && suggestion.translation) {
    patch.translation = suggestion.translation;
  }
  if (!String(existingRow.pronunciation ?? "").trim() && suggestion.pronunciation) {
    patch.pronunciation = suggestion.pronunciation;
  }
  if (!String(existingRow.part_of_speech ?? "").trim() && suggestion.partOfSpeech) {
    patch.part_of_speech = suggestion.partOfSpeech;
  }
  if (!String(existingRow.example ?? "").trim() && suggestion.example) {
    patch.example = suggestion.example;
  }
  if (!String(existingRow.example_translation ?? "").trim() && suggestion.exampleTranslation) {
    patch.example_translation = suggestion.exampleTranslation;
  }

  if (Object.keys(patch).length > 0) {
    patch.source = "ai";
  }

  return patch;
}

async function refillWordbaseRow(request, response) {
  const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body ?? {};
  const wordbaseId = String(body.wordbaseId ?? "").trim();
  const term = String(body.term ?? "").trim();
  const locale = String(body.locale ?? "zh-Hant").trim();

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

  const suggestion = await generateCompleteWordSuggestion(row.term, locale);
  const patch = buildAiPatch(row, suggestion);

  if (Object.keys(patch).length === 0) {
    sendJson(response, 200, {
      updated: false,
      row: mapWordbaseRow(row),
      message: "No missing fields to fill.",
    });
    return;
  }

  const { data: updatedRow, error: updateError } = await serviceClient
    .from("wordbase")
    .update(patch)
    .eq("id", row.id)
    .select(WORD_COLUMNS.join(","))
    .single();

  if (updateError) {
    throw new Error(updateError.message || "Could not update WordBase row.");
  }

  sendJson(response, 200, {
    updated: true,
    row: mapWordbaseRow(updatedRow),
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
      await refillWordbaseRow(request, response);
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
