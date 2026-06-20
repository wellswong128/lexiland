import { sendAuthError } from "../_authz.js";
import {
  createRlsClientForRequest,
  getRequestBody,
  mapGroupRow,
  normalizeGroupCode,
  requireUserGroupAccess,
  sendJson,
} from "../_user-groups.js";

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

function dedupeGroupCodes(values) {
  const deduped = new Set();
  for (const value of values) {
    const normalized = normalizeGroupCode(value);
    if (normalized) {
      deduped.add(normalized);
    }
  }

  return Array.from(deduped);
}

async function getActiveGroupId(rlsClient, userId) {
  const { data, error } = await rlsClient
    .from("user_group_preferences")
    .select("active_group_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load active group.");
  }

  return data?.active_group_id ?? "";
}

async function getPickedGroups(rlsClient, userId) {
  const { data: picks, error: picksError } = await rlsClient
    .from("user_group_picks")
    .select("group_id,picked_at")
    .eq("user_id", userId)
    .order("picked_at", { ascending: true });

  if (picksError) {
    throw new Error(picksError.message || "Failed to load picked groups.");
  }

  const groupIds = (picks ?? []).map((row) => row.group_id).filter(Boolean);
  if (groupIds.length === 0) {
    return [];
  }

  const { data: groups, error: groupsError } = await rlsClient
    .from("word_groups")
    .select(GROUP_COLUMNS.join(","))
    .in("id", groupIds);

  if (groupsError) {
    throw new Error(groupsError.message || "Failed to load group details.");
  }

  const byId = new Map((groups ?? []).map((row) => [row.id, row]));
  return groupIds.map((groupId) => byId.get(groupId)).filter(Boolean).map(mapGroupRow);
}

async function handleGet(request, response, auth) {
  const rlsClient = createRlsClientForRequest(request);
  const userId = auth.user.id;

  const [groups, activeGroupId] = await Promise.all([
    getPickedGroups(rlsClient, userId),
    getActiveGroupId(rlsClient, userId),
  ]);

  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? null;

  sendJson(response, 200, {
    groups,
    activeGroupCode: activeGroup?.groupCode ?? "",
    activeGroupId: activeGroup?.id ?? "",
  });
}

async function handlePut(request, response, auth) {
  const body = getRequestBody(request);
  if (!Array.isArray(body.groupCodes)) {
    sendJson(response, 400, { error: "groupCodes must be an array." });
    return;
  }

  const groupCodes = dedupeGroupCodes(body.groupCodes);
  const rlsClient = createRlsClientForRequest(request);
  const userId = auth.user.id;

  const currentActiveId = await getActiveGroupId(rlsClient, userId);
  const { data: groups, error: groupsError } = groupCodes.length
    ? await rlsClient
        .from("word_groups")
        .select(GROUP_COLUMNS.join(","))
        .in("group_code", groupCodes)
        .eq("is_active", true)
    : { data: [], error: null };

  if (groupsError) {
    throw new Error(groupsError.message || "Failed to validate selected groups.");
  }

  const foundGroups = groups ?? [];
  const foundCodes = new Set(foundGroups.map((row) => row.group_code));
  const missingCodes = groupCodes.filter((code) => !foundCodes.has(code));
  if (missingCodes.length > 0) {
    sendJson(response, 400, {
      error: `Some groupCodes are invalid or inactive: ${missingCodes.join(", ")}`,
    });
    return;
  }

  const nextGroupIds = foundGroups.map((row) => row.id);

  const { data: replacementRows, error: replacementError } = await rlsClient.rpc(
    "replace_user_group_picks",
    { target_group_ids: nextGroupIds },
  );
  if (replacementError) {
    throw new Error(replacementError.message || "Failed to update picked groups.");
  }

  const nextActiveGroupId =
    replacementRows?.[0]?.active_group_id ??
    (nextGroupIds.includes(currentActiveId) ? currentActiveId : nextGroupIds[0]) ??
    "";

  const nextActiveGroup = foundGroups.find((row) => row.id === nextActiveGroupId) ?? null;

  sendJson(response, 200, {
    groups: foundGroups.map(mapGroupRow),
    activeGroupCode: nextActiveGroup?.group_code ?? "",
    activeGroupId: nextActiveGroup?.id ?? "",
  });
}

export default async function handler(request, response) {
  let auth;
  try {
    auth = await requireUserGroupAccess(request);
  } catch (error) {
    sendAuthError(response, error);
    return;
  }

  try {
    if (request.method === "GET") {
      await handleGet(request, response, auth);
      return;
    }

    if (request.method === "PUT") {
      await handlePut(request, response, auth);
      return;
    }

    sendJson(response, 405, { error: "Method not allowed." });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Failed to handle user group picks." });
  }
}
