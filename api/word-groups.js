import { sendAuthError } from "./_authz.js";
import {
  createRlsClientForRequest,
  mapGroupRow,
  requireUserGroupAccess,
  sendJson,
} from "./_user-groups.js";

const GROUP_COLUMNS = [
  "id",
  "group_code",
  "level",
  "grade",
  "subject",
  "display_name_en",
  "display_name_zh_hant",
  "locale",
  "is_active",
];

function parseBoolean(value, defaultValue = false) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return defaultValue;
  }

  return ["1", "true", "yes", "y"].includes(normalized);
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  let auth;
  try {
    auth = await requireUserGroupAccess(request);
  } catch (error) {
    sendAuthError(response, error);
    return;
  }

  try {
    const includeInactive = parseBoolean(request.query?.includeInactive, false);
    const canSeeInactive = auth.role === "owner" || auth.role === "admin";
    const showInactive = includeInactive && canSeeInactive;

    const rlsClient = createRlsClientForRequest(request);
    let query = rlsClient
      .from("word_groups")
      .select(GROUP_COLUMNS.join(","))
      .order("level", { ascending: true })
      .order("grade", { ascending: true })
      .order("subject", { ascending: true });

    if (!showInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message || "Failed to load word groups.");
    }

    sendJson(response, 200, {
      groups: (data ?? []).map(mapGroupRow),
      meta: {
        includeInactive: showInactive,
        total: (data ?? []).length,
      },
    });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Failed to load word groups." });
  }
}
