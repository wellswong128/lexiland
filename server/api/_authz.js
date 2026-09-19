import { createClient } from "@supabase/supabase-js";

const TRUSTED_APP_ROLES = new Set(["owner", "admin", "teacher", "student", "parent"]);
const AI_ALLOWED_ROLES = new Set(["owner", "admin", "teacher", "student"]);

class ApiAuthError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function getSupabaseServerConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

  if (!url || !anonKey) {
    throw new ApiAuthError(500, "Supabase server auth is not configured.");
  }

  return { url, anonKey };
}

function readBearerToken(request) {
  const authHeader = request.headers?.authorization || request.headers?.Authorization || "";
  const [scheme, token] = String(authHeader).split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return "";
  }

  return token.trim();
}

export function getTrustedRoleFromUser(user) {
  const role = String(user?.app_metadata?.role || "").trim().toLowerCase();
  return TRUSTED_APP_ROLES.has(role) ? role : "student";
}

function checkImportApiKey(request) {
  const expectedKey = String(process.env.IMPORT_API_KEY || "").trim();
  if (!expectedKey) {
    return false;
  }

  const providedKey =
    String(request.headers?.["x-lexiland-import-key"] || "").trim();

  return Boolean(providedKey && providedKey === expectedKey);
}

async function readAuthenticatedUser(request) {
  const token = readBearerToken(request);
  if (!token) {
    throw new ApiAuthError(401, "Unauthorized. Please sign in.");
  }

  const { url, anonKey } = getSupabaseServerConfig();
  const supabase = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new ApiAuthError(401, "Unauthorized. Invalid or expired session.");
  }

  return { role: getTrustedRoleFromUser(data.user), user: data.user };
}

function readImportApiKeyHeader(request) {
  return String(request.headers?.["x-lexiland-import-key"] || "").trim();
}

export async function requireRole(
  request,
  allowedRoles,
  { allowImportKey = false } = {},
) {
  if (allowImportKey && checkImportApiKey(request)) {
    return { source: "import-key", role: "owner", user: null };
  }

  if (allowImportKey) {
    const providedImportKey = readImportApiKeyHeader(request);
    const expectedImportKey = String(process.env.IMPORT_API_KEY || "").trim();

    if (providedImportKey && !expectedImportKey) {
      throw new ApiAuthError(
        401,
        process.env.VERCEL
          ? "Import API key is not configured on the server. Set IMPORT_API_KEY in Vercel and redeploy."
          : "Import API key is not configured on the local API server. Set IMPORT_API_KEY in .env.local and restart `npm run dev`.",
      );
    }

    if (providedImportKey && expectedImportKey && providedImportKey !== expectedImportKey) {
      throw new ApiAuthError(
        401,
        "Invalid import API key. Use the same IMPORT_API_KEY value in .env.local and Vercel.",
      );
    }
  }

  const auth = await readAuthenticatedUser(request);
  if (!allowedRoles.includes(auth.role)) {
    throw new ApiAuthError(403, "Forbidden. Your role cannot access this API.");
  }

  return { source: "bearer", role: auth.role, user: auth.user };
}

export async function requireAiApiAccess(request) {
  const providedImportKey = readImportApiKeyHeader(request);
  const expectedImportKey = String(process.env.IMPORT_API_KEY || "").trim();

  if (providedImportKey && !expectedImportKey) {
    throw new ApiAuthError(
      401,
      process.env.VERCEL
        ? "Import API key is not configured on the server. Set IMPORT_API_KEY in Vercel and redeploy."
        : "Import API key is not configured on the local API server. Set IMPORT_API_KEY in .env.local and restart `npm run dev`.",
    );
  }

  if (providedImportKey && expectedImportKey && providedImportKey !== expectedImportKey) {
    throw new ApiAuthError(
      401,
      "Invalid import API key. Use the same IMPORT_API_KEY value in .env.local and Vercel.",
    );
  }

  if (checkImportApiKey(request)) {
    return { source: "import-key", role: "owner", user: null };
  }

  const token = readBearerToken(request);
  if (!token) {
    return { source: "guest", role: "guest", user: null };
  }

  const auth = await readAuthenticatedUser(request);
  if (!AI_ALLOWED_ROLES.has(auth.role)) {
    throw new ApiAuthError(403, "Forbidden. Your role cannot access this API.");
  }

  return { source: "bearer", role: auth.role, user: auth.user };
}

export function sendAuthError(response, error) {
  const statusCode = error?.statusCode || 500;
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({ error: error.message || "Authorization failed." }));
}
