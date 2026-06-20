import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { requireRole, sendAuthError } from "../_authz.js";
import { generateWordMemoryImage } from "./word-memory-image.js";

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
  "term",
  "definition",
  "translation",
  "example",
  "example_translation",
  "memory_tips_by_locale",
  "memory_image",
  "contributor_id",
  "updated_at",
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

function parseLimit(value, defaultValue = 50) {
  const number = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(number) || number <= 0) {
    return defaultValue;
  }

  return Math.min(number, 120);
}

function parsePage(value, defaultValue = 1) {
  const number = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(number) || number <= 0) {
    return defaultValue;
  }

  return number;
}

async function lookupContributorEmails(serviceClient, rows) {
  const contributorIds = [...new Set(rows.map((row) => row.contributor_id).filter(Boolean))];
  const contributorEmailMap = {};

  await Promise.all(
    contributorIds.map(async (contributorId) => {
      try {
        const { data, error } = await serviceClient.auth.admin.getUserById(contributorId);
        if (!error && data?.user?.email) {
          contributorEmailMap[contributorId] = data.user.email;
        }
      } catch {
        contributorEmailMap[contributorId] = "";
      }
    }),
  );

  return contributorEmailMap;
}

function mapWordbaseRow(row, contributorEmailMap = {}) {
  return {
    id: row.id,
    term: row.term ?? "",
    definition: row.definition ?? "",
    translation: row.translation ?? "",
    example: row.example ?? "",
    exampleTranslation: row.example_translation ?? "",
    memoryTipsByLocale:
      row.memory_tips_by_locale && typeof row.memory_tips_by_locale === "object"
        ? row.memory_tips_by_locale
        : {},
    memoryImage: row.memory_image ?? null,
    contributorId: row.contributor_id ?? "",
    contributorEmail: contributorEmailMap[row.contributor_id] ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

async function listRows(request, response) {
  const serviceClient = getServiceClient();
  const search = String(request.query?.search ?? "").trim();
  const pageSize = parseLimit(request.query?.pageSize, 20);
  const page = parsePage(request.query?.page, 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = serviceClient
    .from("wordbase")
    .select(WORD_COLUMNS.join(","), { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (search) {
    query = query.or(
      `term.ilike.%${search}%,definition.ilike.%${search}%,translation.ilike.%${search}%`,
    );
  }

  const { data, error, count } = await query;
  if (error) {
    throw new Error(error.message || "Failed to load WordBase rows.");
  }

  const rows = data ?? [];
  const total = Number(count ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const contributorEmailMap = await lookupContributorEmails(serviceClient, rows);
  sendJson(response, 200, {
    rows: rows.map((row) => mapWordbaseRow(row, contributorEmailMap)),
    meta: {
      page,
      pageSize,
      total,
      totalPages,
    },
  });
}

async function regenerateMemoryImage(request, response) {
  const serviceClient = getServiceClient();
  const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body ?? {};
  const wordbaseId = String(body.wordbaseId ?? "").trim();

  if (!wordbaseId) {
    sendJson(response, 400, { error: "wordbaseId is required." });
    return;
  }

  const { data: row, error: rowError } = await serviceClient
    .from("wordbase")
    .select(WORD_COLUMNS.join(","))
    .eq("id", wordbaseId)
    .maybeSingle();

  if (rowError) {
    throw new Error(rowError.message || "Could not load WordBase row.");
  }

  if (!row) {
    sendJson(response, 404, { error: "WordBase row not found." });
    return;
  }

  const apiKey = String(process.env.AGNES_API_KEY || "").trim();
  const image = await generateWordMemoryImage({
    term: row.term,
    definition: row.definition,
    translation: row.translation,
    example: row.example,
    apiKey,
  });

  const memoryImage = {
    imageUrl: image.imageUrl,
    prompt: image.prompt ?? "",
    model: image.model ?? "",
    size: image.size ?? "",
    savedAt: new Date().toISOString(),
  };

  const { data: updatedRow, error: updateError } = await serviceClient
    .from("wordbase")
    .update({
      memory_image: memoryImage,
      source: "ai",
    })
    .eq("id", row.id)
    .select(WORD_COLUMNS.join(","))
    .single();

  if (updateError) {
    throw new Error(updateError.message || "Could not update WordBase memory image.");
  }

  const contributorEmailMap = await lookupContributorEmails(serviceClient, [updatedRow]);
  sendJson(response, 200, {
    row: mapWordbaseRow(updatedRow, contributorEmailMap),
  });
}

export default async function handler(request, response) {
  try {
    await requireRole(request, ["owner", "admin"]);

    if (request.method === "GET") {
      await listRows(request, response);
      return;
    }

    if (request.method === "POST") {
      await regenerateMemoryImage(request, response);
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
