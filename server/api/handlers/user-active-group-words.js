import { sendAuthError } from "../_authz.js";
import {
  createRlsClientForRequest,
  normalizeGroupCode,
  requireUserGroupAccess,
  sendJson,
} from "../_user-groups.js";

function normalizeTerm(value) {
  return String(value ?? "").trim().toLowerCase();
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
    const rlsClient = createRlsClientForRequest(request);
    const userId = auth.user.id;

    const { data: preference, error: preferenceError } = await rlsClient
      .from("user_group_preferences")
      .select("active_group_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (preferenceError) {
      throw new Error(preferenceError.message || "Failed to load active group.");
    }

    const activeGroupId = preference?.active_group_id ?? "";
    if (!activeGroupId) {
      sendJson(response, 200, {
        activeGroup: null,
        mappedTerms: [],
      });
      return;
    }

    const { data: group, error: groupError } = await rlsClient
      .from("word_groups")
      .select("id,group_code,grade,subject,display_name_en,display_name_zh_hant")
      .eq("id", activeGroupId)
      .maybeSingle();

    if (groupError) {
      throw new Error(groupError.message || "Failed to load active group details.");
    }
    if (!group) {
      sendJson(response, 200, {
        activeGroup: null,
        mappedTerms: [],
      });
      return;
    }

    const { data: mappings, error: mappingError } = await rlsClient
      .from("wordbase_group_map")
      .select("wordbase_id")
      .eq("group_id", activeGroupId);

    if (mappingError) {
      throw new Error(mappingError.message || "Failed to load group mappings.");
    }

    const wordbaseIds = [...new Set((mappings ?? []).map((row) => row.wordbase_id).filter(Boolean))];
    if (wordbaseIds.length === 0) {
      sendJson(response, 200, {
        activeGroup: {
          id: group.id,
          groupCode: normalizeGroupCode(group.group_code),
          grade: group.grade ?? "",
          subject: group.subject ?? "",
          displayNameEn: group.display_name_en ?? "",
          displayNameZhHant: group.display_name_zh_hant ?? "",
        },
        mappedTerms: [],
      });
      return;
    }

    const { data: wordbaseRows, error: wordbaseError } = await rlsClient
      .from("wordbase")
      .select("term_key,term")
      .in("id", wordbaseIds);

    if (wordbaseError) {
      throw new Error(wordbaseError.message || "Failed to load mapped words.");
    }

    const mappedTerms = [...new Set(
      (wordbaseRows ?? [])
        .flatMap((row) => [normalizeTerm(row.term_key), normalizeTerm(row.term)])
        .filter(Boolean),
    )];

    sendJson(response, 200, {
      activeGroup: {
        id: group.id,
        groupCode: normalizeGroupCode(group.group_code),
        grade: group.grade ?? "",
        subject: group.subject ?? "",
        displayNameEn: group.display_name_en ?? "",
        displayNameZhHant: group.display_name_zh_hant ?? "",
      },
      mappedTerms,
    });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Failed to load active-group words." });
  }
}
