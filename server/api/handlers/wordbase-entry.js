import { sendAuthError } from "../_authz.js";
import {
  createRlsClientForRequest,
  requireUserGroupAccess,
  sendJson,
} from "../_user-groups.js";

const WORDBASE_ENTRY_COLUMNS =
  "id,term_key,term,definition,translation,pronunciation,part_of_speech,example,example_translation,notes,tags,source,memory_tips_by_locale,memory_image,created_at,updated_at";

function normalizeTermKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

function mapWordbaseEntry(row) {
  return {
    id: row.id,
    term: row.term,
    definition: row.definition ?? "",
    translation: row.translation ?? "",
    pronunciation: row.pronunciation ?? "",
    partOfSpeech: row.part_of_speech ?? "",
    example: row.example ?? "",
    exampleTranslation: row.example_translation ?? "",
    notes: row.notes ?? "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    source: row.source ?? "",
    memoryTipsByLocale: row.memory_tips_by_locale ?? {},
    memoryImage: row.memory_image ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  try {
    await requireUserGroupAccess(request);
  } catch (error) {
    sendAuthError(response, error);
    return;
  }

  const termKey = normalizeTermKey(request.query?.term);
  if (!termKey) {
    sendJson(response, 400, { error: "term is required." });
    return;
  }

  try {
    const rlsClient = createRlsClientForRequest(request);
    const { data, error } = await rlsClient
      .from("wordbase")
      .select(WORDBASE_ENTRY_COLUMNS)
      .eq("term_key", termKey)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(error.message || "Failed to load wordbase entry.");
    }

    const row = Array.isArray(data) ? data[0] : null;
    sendJson(response, 200, { entry: row ? mapWordbaseEntry(row) : null });
  } catch (error) {
    sendJson(response, 500, {
      error: error.message || "Failed to load wordbase entry.",
    });
  }
}
