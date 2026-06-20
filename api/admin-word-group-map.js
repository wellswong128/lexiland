import { requireRole, sendAuthError } from "./_authz.js";
import { getAdminServiceClient, getRequestBody, sendJson } from "./_admin-supabase.js";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

async function resolveGroupId(serviceClient, body) {
  const directId = normalizeText(body.groupId);
  if (directId) {
    return directId;
  }

  const groupCode = normalizeLower(body.groupCode);
  if (!groupCode) {
    return "";
  }

  const { data, error } = await serviceClient
    .from("word_groups")
    .select("id")
    .eq("group_code", groupCode)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to resolve groupCode.");
  }

  return data?.id ?? "";
}

async function resolveWordbaseId(serviceClient, body) {
  const directId = normalizeText(body.wordbaseId);
  if (directId) {
    return directId;
  }

  const termKey = normalizeLower(body.termKey);
  if (!termKey) {
    return "";
  }

  const { data, error } = await serviceClient
    .from("wordbase")
    .select("id")
    .eq("term_key", termKey)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to resolve termKey.");
  }

  return data?.id ?? "";
}

async function ensureExistsById(serviceClient, table, id) {
  const { data, error } = await serviceClient.from(table).select("id").eq("id", id).maybeSingle();
  if (error) {
    throw new Error(error.message || `Failed to validate ${table} id.`);
  }

  return Boolean(data?.id);
}

async function createMapping(request, response, actorId) {
  const body = getRequestBody(request);
  const serviceClient = getAdminServiceClient();

  const [groupId, wordbaseId] = await Promise.all([
    resolveGroupId(serviceClient, body),
    resolveWordbaseId(serviceClient, body),
  ]);

  if (!groupId || !wordbaseId) {
    sendJson(response, 400, {
      error:
        "groupId/groupCode and wordbaseId/termKey are required and must resolve to existing records.",
    });
    return;
  }

  const [groupExists, wordExists] = await Promise.all([
    ensureExistsById(serviceClient, "word_groups", groupId),
    ensureExistsById(serviceClient, "wordbase", wordbaseId),
  ]);

  if (!groupExists || !wordExists) {
    sendJson(response, 404, { error: "word group or wordbase record not found." });
    return;
  }

  const { data, error } = await serviceClient
    .from("wordbase_group_map")
    .upsert(
      {
        group_id: groupId,
        wordbase_id: wordbaseId,
        created_by: actorId || null,
      },
      { onConflict: "wordbase_id,group_id" },
    )
    .select("id,wordbase_id,group_id,created_by,created_at")
    .single();

  if (error) {
    throw new Error(error.message || "Failed to create mapping.");
  }

  sendJson(response, 200, {
    mapping: {
      id: data.id,
      wordbaseId: data.wordbase_id,
      groupId: data.group_id,
      createdBy: data.created_by ?? "",
      createdAt: data.created_at ?? "",
    },
  });
}

async function deleteMapping(request, response) {
  const body = getRequestBody(request);
  const serviceClient = getAdminServiceClient();

  const [groupId, wordbaseId] = await Promise.all([
    resolveGroupId(serviceClient, body),
    resolveWordbaseId(serviceClient, body),
  ]);

  if (!groupId || !wordbaseId) {
    sendJson(response, 400, {
      error:
        "groupId/groupCode and wordbaseId/termKey are required and must resolve to existing records.",
    });
    return;
  }

  const { error } = await serviceClient
    .from("wordbase_group_map")
    .delete()
    .eq("group_id", groupId)
    .eq("wordbase_id", wordbaseId);

  if (error) {
    throw new Error(error.message || "Failed to delete mapping.");
  }

  sendJson(response, 200, {
    success: true,
    wordbaseId,
    groupId,
  });
}

export default async function handler(request, response) {
  try {
    const auth = await requireRole(request, ["owner", "admin"]);

    if (request.method === "POST") {
      await createMapping(request, response, auth.user?.id);
      return;
    }

    if (request.method === "DELETE") {
      await deleteMapping(request, response);
      return;
    }

    sendJson(response, 405, { error: "Method not allowed." });
  } catch (error) {
    if (error?.statusCode) {
      sendAuthError(response, error);
      return;
    }

    sendJson(response, 500, { error: error.message || "Failed to manage group mapping." });
  }
}
