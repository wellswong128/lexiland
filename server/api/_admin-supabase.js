import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

let localEnvLoaded = false;

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

export function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

export function getRequestBody(request) {
  if (typeof request.body === "string") {
    return JSON.parse(request.body || "{}");
  }

  return request.body ?? {};
}

export function getAdminServiceClient() {
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
