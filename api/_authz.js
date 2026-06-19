import { createClient } from "@supabase/supabase-js";

const ALLOWED_ROLES = new Set(["owner", "admin", "teacher", "student"]);

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

function normalizeRole(user) {
  const candidate =
    user?.app_metadata?.role ?? user?.user_metadata?.role ?? user?.role ?? "student";
  const role = String(candidate || "").trim().toLowerCase();
  return role || "student";
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

export async function requireAiApiAccess(request) {
  if (checkImportApiKey(request)) {
    return { source: "import-key", role: "owner", user: null };
  }

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

  const role = normalizeRole(data.user);
  if (!ALLOWED_ROLES.has(role)) {
    throw new ApiAuthError(403, "Forbidden. Your role cannot use this API.");
  }

  return { source: "bearer", role, user: data.user };
}

export function sendAuthError(response, error) {
  const statusCode = error?.statusCode || 500;
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({ error: error.message || "Authorization failed." }));
}
