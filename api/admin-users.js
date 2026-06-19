import { createClient } from "@supabase/supabase-js";
import { requireRole, sendAuthError } from "./_authz.js";

const ASSIGNABLE_ROLES = ["owner", "admin", "teacher", "student", "parent"];
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
];

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
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

function mapUser(user) {
  const role =
    user?.app_metadata?.role ??
    user?.user_metadata?.role ??
    user?.role ??
    "student";

  return {
    id: user.id,
    email: user.email ?? "",
    role: String(role).toLowerCase(),
    createdAt: user.created_at ?? "",
    lastSignInAt: user.last_sign_in_at ?? "",
  };
}

async function listUsers(response) {
  const serviceClient = getServiceClient();
  const { data, error } = await serviceClient.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (error) {
    sendJson(response, 500, { error: error.message });
    return;
  }

  const users = (data?.users ?? []).map(mapUser);
  sendJson(response, 200, { users });
}

async function updateUserRole(request, response, actorRole) {
  const body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body ?? {};
  const userId = String(body.userId ?? "").trim();
  const role = String(body.role ?? "").trim().toLowerCase();

  if (!userId || !role) {
    sendJson(response, 400, { error: "userId and role are required." });
    return;
  }

  if (!ASSIGNABLE_ROLES.includes(role)) {
    sendJson(response, 400, { error: "Invalid role." });
    return;
  }

  if (actorRole !== "owner" && (role === "owner" || role === "admin")) {
    sendJson(response, 403, { error: "Only owner can assign owner/admin roles." });
    return;
  }

  const serviceClient = getServiceClient();
  const { data: userData, error: getError } = await serviceClient.auth.admin.getUserById(userId);

  if (getError || !userData?.user) {
    sendJson(response, 404, { error: "User not found." });
    return;
  }

  const targetRole =
    userData.user?.app_metadata?.role ??
    userData.user?.user_metadata?.role ??
    userData.user?.role ??
    "student";

  if (actorRole !== "owner" && String(targetRole).toLowerCase() === "owner") {
    sendJson(response, 403, { error: "Only owner can modify owner accounts." });
    return;
  }

  const appMetadata = {
    ...(userData.user.app_metadata ?? {}),
    role,
  };

  const { data: updatedUserData, error: updateError } =
    await serviceClient.auth.admin.updateUserById(userId, {
      app_metadata: appMetadata,
    });

  if (updateError || !updatedUserData?.user) {
    sendJson(response, 500, { error: updateError?.message || "Failed to update role." });
    return;
  }

  sendJson(response, 200, { user: mapUser(updatedUserData.user) });
}

export default async function handler(request, response) {
  try {
    const auth = await requireRole(request, ["owner", "admin"]);

    if (request.method === "GET") {
      await listUsers(response);
      return;
    }

    if (request.method === "PATCH") {
      await updateUserRole(request, response, auth.role);
      return;
    }

    sendJson(response, 405, { error: "Method not allowed." });
  } catch (error) {
    sendAuthError(response, error);
  }
}
