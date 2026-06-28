import { sendAuthError } from "../_authz.js";
import {
  importMappedWordsForUser,
} from "../_import-group-words.js";
import {
  buildActiveGroupWordPayload,
  createRlsClientForRequest,
  fetchWordbaseRowsByIds,
  getRequestBody,
  normalizeGroupCode,
  requireUserGroupAccess,
  sendJson,
} from "../_user-groups.js";

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

function parsePositiveInt(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function mapActiveGroup(group) {
  return {
    id: group.id,
    groupCode: normalizeGroupCode(group.group_code),
    grade: group.grade ?? "",
    subject: group.subject ?? "",
    displayNameEn: group.display_name_en ?? "",
    displayNameZhHant: group.display_name_zh_hant ?? "",
  };
}

async function loadActiveGroupContext(rlsClient, userId) {
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
    return { activeGroup: null, group: null, mappings: [] };
  }

  const [
    { data: group, error: groupError },
    { data: mappings, error: mappingError },
  ] = await Promise.all([
    rlsClient
      .from("word_groups")
      .select("id,group_code,grade,subject,display_name_en,display_name_zh_hant")
      .eq("id", activeGroupId)
      .maybeSingle(),
    rlsClient
      .from("wordbase_group_map")
      .select("wordbase_id")
      .eq("group_id", activeGroupId),
  ]);

  if (groupError) {
    throw new Error(groupError.message || "Failed to load active group details.");
  }
  if (mappingError) {
    throw new Error(mappingError.message || "Failed to load group mappings.");
  }

  return {
    activeGroup: group ? mapActiveGroup(group) : null,
    group,
    mappings: mappings ?? [],
  };
}

async function handleGet(request, response, auth) {
  const rlsClient = createRlsClientForRequest(request);
  const includeWords = parseBoolean(request.query?.includeWords, false);
  const wordLimit = parsePositiveInt(request.query?.wordLimit);
  const { activeGroup, group, mappings } = await loadActiveGroupContext(
    rlsClient,
    auth.user.id,
  );

  if (!activeGroup || !group) {
    sendJson(response, 200, {
      activeGroup: null,
      mappedTerms: [],
    });
    return;
  }

  const wordbaseIds = [...new Set(mappings.map((row) => row.wordbase_id).filter(Boolean))];
  if (wordbaseIds.length === 0) {
    sendJson(response, 200, {
      activeGroup,
      mappedTerms: [],
    });
    return;
  }

  const wordbaseSelect = includeWords
    ? "term_key,term,definition,translation,pronunciation,part_of_speech,example,example_translation,tags,memory_tips_by_locale,memory_image"
    : "term_key,term,definition";

  const wordbaseRows = await fetchWordbaseRowsByIds(rlsClient, wordbaseIds, wordbaseSelect);

  const { mappedTerms, mappedWords } = buildActiveGroupWordPayload(wordbaseRows, {
    includeWords,
    wordLimit,
  });

  const payload = {
    activeGroup,
    mappedTerms,
  };

  if (includeWords) {
    payload.mappedWords = mappedWords;
  }

  sendJson(response, 200, payload);
}

async function handlePost(request, response, auth) {
  const body = getRequestBody(request);
  const limit =
    body.limit == null || body.limit === ""
      ? null
      : parsePositiveInt(body.limit) || null;
  const wordLimit = parsePositiveInt(body.wordLimit);
  const rlsClient = createRlsClientForRequest(request);
  const userId = auth.user.id;

  const { activeGroup, group, mappings } = await loadActiveGroupContext(rlsClient, userId);

  if (!activeGroup || !group) {
    sendJson(response, 200, {
      activeGroup: null,
      mappedTerms: [],
      mappedWords: [],
      importedWords: [],
    });
    return;
  }

  const wordbaseIds = [...new Set(mappings.map((row) => row.wordbase_id).filter(Boolean))];
  if (wordbaseIds.length === 0) {
    sendJson(response, 200, {
      activeGroup,
      mappedTerms: [],
      mappedWords: [],
      importedWords: [],
    });
    return;
  }

  const wordbaseSelect =
    "term_key,term,definition,translation,pronunciation,part_of_speech,example,example_translation,tags,memory_tips_by_locale,memory_image";

  const wordbaseRows = await fetchWordbaseRowsByIds(rlsClient, wordbaseIds, wordbaseSelect);

  const { mappedTerms, mappedWords } = buildActiveGroupWordPayload(wordbaseRows, {
    includeWords: true,
    wordLimit,
  });

  const importedWords = await importMappedWordsForUser(rlsClient, userId, mappedWords, {
    limit,
  });

  sendJson(response, 200, {
    activeGroup,
    mappedTerms,
    mappedWords,
    importedWords,
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

    if (request.method === "POST") {
      await handlePost(request, response, auth);
      return;
    }

    sendJson(response, 405, { error: "Method not allowed." });
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || "Failed to handle active-group words.",
    });
  }
}
