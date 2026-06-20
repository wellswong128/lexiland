import { createClient } from "@supabase/supabase-js";
import { requireRole } from "./_authz.js";

const USER_GROUP_ALLOWED_ROLES = ["owner", "admin", "teacher", "student"];
const URL_ENV_KEYS = [
  "SUPABASE_URL",
  "VITE_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "PUBLIC_SUPABASE_URL",
];
const ANON_KEY_ENV_KEYS = [
  "SUPABASE_ANON_KEY",
  "VITE_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "PUBLIC_SUPABASE_ANON_KEY",
];

function readFirstEnvValue(keys) {
  for (const key of keys) {
    const value = String(process.env[key] || "").trim();
    if (value) {
      return value;
    }
  }

  return "";
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

export function readBearerToken(request) {
  const authHeader = request.headers?.authorization || request.headers?.Authorization || "";
  const [scheme, token] = String(authHeader).split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return "";
  }

  return token.trim();
}

function getSupabaseAuthConfig() {
  const url = readFirstEnvValue(URL_ENV_KEYS);
  const anonKey = readFirstEnvValue(ANON_KEY_ENV_KEYS);

  if (!url || !anonKey) {
    throw new Error("Supabase server auth is not configured.");
  }

  return { url, anonKey };
}

export async function requireUserGroupAccess(request) {
  return requireRole(request, USER_GROUP_ALLOWED_ROLES);
}

export function createRlsClientForRequest(request) {
  const token = readBearerToken(request);
  if (!token) {
    throw new Error("Unauthorized. Please sign in.");
  }

  const { url, anonKey } = getSupabaseAuthConfig();

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

export function normalizeGroupCode(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function mapGroupRow(row) {
  return {
    id: row.id,
    groupCode: row.group_code,
    level: row.level,
    grade: row.grade,
    subject: row.subject,
    displayNameEn: row.display_name_en ?? "",
    displayNameZhHant: row.display_name_zh_hant ?? "",
    locale: row.locale ?? "zh-Hant",
    isActive: Boolean(row.is_active),
  };
}
