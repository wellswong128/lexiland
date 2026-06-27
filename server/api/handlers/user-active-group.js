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

function normalizeTermForGroup(value) {
  return String(value ?? "").trim().toLowerCase();
}

async function fetchGroupMappedWords(rlsClient, groupId, includeWords) {
  const { data: mappings, error: mappingError } = await rlsClient
    .from("wordbase_group_map")
    .select("wordbase_id")
    .eq("group_id", groupId);

  if (mappingError) {
    throw new Error(mappingError.message || "Failed to load group mappings.");
  }

  const wordbaseIds = [...new Set((mappings ?? []).map((row) => row.wordbase_id).filter(Boolean))];
  if (wordbaseIds.length === 0) {
    return { mappedTerms: [], mappedWords: [] };
  }

  const wordbaseSelect = includeWords
    ? "term_key,term,definition,translation,pronunciation,part_of_speech,example,example_translation,tags,memory_tips_by_locale,memory_image"
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
      .flatMap((row) => [normalizeTermForGroup(row.term_key), normalizeTermForGroup(row.term)])
      .filter(Boolean),
  )];

  let mappedWords = [];
  if (includeWords) {
    mappedWords = (wordbaseRows ?? []).map((row) => ({
      term: row.term ?? "",
      definition: row.definition ?? "",
      translation: row.translation ?? "",
      pronunciation: row.pronunciation ?? "",
      partOfSpeech: row.part_of_speech ?? "",
      example: row.example ?? "",
      exampleTranslation: row.example_translation ?? "",
      tags: Array.isArray(row.tags) ? row.tags : [],
      memoryTipsByLocale:
        row.memory_tips_by_locale && typeof row.memory_tips_by_locale === "object"
          ? row.memory_tips_by_locale
          : {},
      memoryImage:
        row.memory_image && typeof row.memory_image === "object"
          ? row.memory_image
          : null,
    }));
  }

  return { mappedTerms, mappedWords };
}

async function readActiveGroup(rlsClient, userId) {
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
    return null;
  }

  const { data: group, error: groupError } = await rlsClient
    .from("word_groups")
    .select(GROUP_COLUMNS.join(","))
    .eq("id", activeGroupId)
    .maybeSingle();

  if (groupError) {
    throw new Error(groupError.message || "Failed to load active group details.");
  }

  return group ? mapGroupRow(group) : null;
}

async function handleGet(request, response, auth) {
  const rlsClient = createRlsClientForRequest(request);
  const activeGroup = await readActiveGroup(rlsClient, auth.user.id);
  sendJson(response, 200, {
    activeGroup,
    activeGroupCode: activeGroup?.groupCode ?? "",
    activeGroupId: activeGroup?.id ?? "",
  });
}

async function handlePut(request, response, auth) {
  const body = getRequestBody(request);
  const groupCode = normalizeGroupCode(body.groupCode);
  if (!groupCode) {
    sendJson(response, 400, { error: "groupCode is required." });
    return;
  }

  const includeWords = Boolean(body.includeWords);
  const rlsClient = createRlsClientForRequest(request);
  const userId = auth.user.id;

  const { data: group, error: groupError } = await rlsClient
    .from("word_groups")
    .select(GROUP_COLUMNS.join(","))
    .eq("group_code", groupCode)
    .eq("is_active", true)
    .maybeSingle();

  if (groupError) {
    throw new Error(groupError.message || "Failed to validate groupCode.");
  }
  if (!group) {
    sendJson(response, 400, { error: "groupCode is invalid or inactive." });
    return;
  }

  const { data: pick, error: pickError } = await rlsClient
    .from("user_group_picks")
    .select("group_id")
    .eq("user_id", userId)
    .eq("group_id", group.id)
    .maybeSingle();

  if (pickError) {
    throw new Error(pickError.message || "Failed to validate picked group.");
  }
  if (!pick) {
    sendJson(response, 400, {
      error: "active group must belong to picked groups.",
    });
    return;
  }

  const { error: upsertError } = await rlsClient
    .from("user_group_preferences")
    .upsert({ user_id: userId, active_group_id: group.id });

  if (upsertError) {
    throw new Error(upsertError.message || "Failed to set active group.");
  }

  const activeGroup = mapGroupRow(group);
  const { mappedTerms, mappedWords } = await fetchGroupMappedWords(rlsClient, group.id, includeWords);

  const payload = {
    activeGroup,
    activeGroupCode: group.group_code,
    activeGroupId: group.id,
    mappedTerms,
  };

  if (includeWords) {
    payload.mappedWords = mappedWords;
  }

  sendJson(response, 200, payload);
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
    sendJson(response, 500, { error: error.message || "Failed to handle active group." });
  }
}
