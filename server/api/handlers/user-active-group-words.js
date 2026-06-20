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

function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
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
    const includeWords = parseBoolean(request.query?.includeWords, false);
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

    const wordbaseSelect = includeWords
      ? "term_key,term,definition,translation,pronunciation,part_of_speech,example,example_translation,tags"
      : "term_key,term";

    const { data: wordbaseRows, error: wordbaseError } = await rlsClient
      .from("wordbase")
      .select(wordbaseSelect)
      .in("id", wordbaseIds);

    if (wordbaseError) {
      throw new Error(wordbaseError.message || "Failed to load mapped words.");
    }

    const mappedTerms = [...new Set(
      (wordbaseRows ?? [])
        .flatMap((row) => [normalizeTerm(row.term_key), normalizeTerm(row.term)])
        .filter(Boolean),
    )];

    const payload = {
      activeGroup: {
        id: group.id,
        groupCode: normalizeGroupCode(group.group_code),
        grade: group.grade ?? "",
        subject: group.subject ?? "",
        displayNameEn: group.display_name_en ?? "",
        displayNameZhHant: group.display_name_zh_hant ?? "",
      },
      mappedTerms,
    };

    if (includeWords) {
      payload.mappedWords = (wordbaseRows ?? []).map((row) => ({
        term: row.term ?? "",
        definition: row.definition ?? "",
        translation: row.translation ?? "",
        pronunciation: row.pronunciation ?? "",
        partOfSpeech: row.part_of_speech ?? "",
        example: row.example ?? "",
        exampleTranslation: row.example_translation ?? "",
        tags: Array.isArray(row.tags) ? row.tags : [],
      }));
    }

    sendJson(response, 200, payload);
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Failed to load active-group words." });
  }
}
