import { requireRole, sendAuthError } from "../_authz.js";
import { getAdminServiceClient, getRequestBody, sendJson } from "../_admin-supabase.js";

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
  "created_by",
  "created_at",
  "updated_at",
];

const GRADE_SUBJECT_MATRIX = Object.freeze({
  P1: new Set(["english", "mathematics", "general-studies"]),
  P2: new Set(["english", "mathematics", "general-studies"]),
  P3: new Set(["english", "mathematics", "general-studies"]),
  P4: new Set(["english", "mathematics", "general-studies", "science"]),
  P5: new Set(["english", "mathematics", "general-studies", "science"]),
  P6: new Set(["english", "mathematics", "general-studies", "science"]),
  S1: new Set([
    "english",
    "mathematics",
    "integrated-science",
    "chinese-history",
    "history",
    "geography",
  ]),
  S2: new Set([
    "english",
    "mathematics",
    "integrated-science",
    "chinese-history",
    "history",
    "geography",
  ]),
  S3: new Set([
    "english",
    "mathematics",
    "integrated-science",
    "chinese-history",
    "history",
    "geography",
  ]),
  S4: new Set([
    "english",
    "mathematics",
    "physics",
    "chemistry",
    "biology",
    "economics",
    "geography",
    "history",
    "ict",
  ]),
  S5: new Set([
    "english",
    "mathematics",
    "physics",
    "chemistry",
    "biology",
    "economics",
    "geography",
    "history",
    "ict",
  ]),
  S6: new Set([
    "english",
    "mathematics",
    "physics",
    "chemistry",
    "biology",
    "economics",
    "geography",
    "history",
    "ict",
  ]),
});

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

function parseBoolean(value, defaultValue = false) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = normalizeLower(value);
  if (!normalized) {
    return defaultValue;
  }

  return ["1", "true", "yes", "y"].includes(normalized);
}

function parseLimit(value, defaultValue = 100) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return Math.min(parsed, 500);
}

function mapGroupRow(row) {
  return {
    id: row.id,
    groupCode: row.group_code,
    level: row.level,
    grade: row.grade,
    subject: row.subject,
    displayNameEn: row.display_name_en ?? "",
    displayNameZhHant: row.display_name_zh_hant ?? "",
    locale: row.locale ?? "zh-Hant",
    isActive: Boolean(row.is_active),
    createdBy: row.created_by ?? "",
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

function buildGroupCode(level, grade, subject) {
  return `hk-${normalizeLower(level)}-${normalizeLower(grade)}-${normalizeLower(subject)}`;
}

function validateGradeSubject(grade, subject) {
  const allowedSubjects = GRADE_SUBJECT_MATRIX[normalizeUpper(grade)];
  if (!allowedSubjects) {
    return false;
  }

  return allowedSubjects.has(normalizeLower(subject));
}

function validateGroupPayload(body, { allowPartial = false } = {}) {
  const level = normalizeLower(body.level);
  const grade = normalizeUpper(body.grade);
  const subject = normalizeLower(body.subject);
  const displayNameEn = normalizeText(body.displayNameEn);
  const displayNameZhHant = normalizeText(body.displayNameZhHant);
  const locale = normalizeText(body.locale || "zh-Hant");
  const hasActiveFlag = typeof body.isActive !== "undefined";
  const isActive = hasActiveFlag ? Boolean(body.isActive) : true;

  if (!allowPartial || level) {
    if (!["primary", "secondary"].includes(level)) {
      return { error: "level must be primary or secondary." };
    }
  }

  if (!allowPartial || grade) {
    if (!GRADE_SUBJECT_MATRIX[grade]) {
      return { error: "grade must be one of P1-P6 or S1-S6." };
    }
  }

  if (!allowPartial || subject) {
    if (!subject) {
      return { error: "subject is required." };
    }
  }

  if ((level || grade || subject) && !validateGradeSubject(grade, subject)) {
    return { error: "subject is not valid for the selected grade." };
  }

  if (!allowPartial || displayNameEn) {
    if (!displayNameEn) {
      return { error: "displayNameEn is required." };
    }
  }

  return {
    value: {
      level: level || undefined,
      grade: grade || undefined,
      subject: subject || undefined,
      displayNameEn: displayNameEn || undefined,
      displayNameZhHant: displayNameZhHant || undefined,
      locale,
      isActive,
      hasActiveFlag,
    },
  };
}

async function listGroups(request, response) {
  const serviceClient = getAdminServiceClient();
  const search = normalizeText(request.query?.search);
  const includeInactive = parseBoolean(request.query?.includeInactive, true);
  const limit = parseLimit(request.query?.limit, 100);

  let query = serviceClient
    .from("word_groups")
    .select(GROUP_COLUMNS.join(","))
    .order("level", { ascending: true })
    .order("grade", { ascending: true })
    .order("subject", { ascending: true })
    .limit(limit);

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  if (search) {
    query = query.or(
      `group_code.ilike.%${search}%,display_name_en.ilike.%${search}%,display_name_zh_hant.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || "Failed to load groups.");
  }

  sendJson(response, 200, {
    groups: (data ?? []).map(mapGroupRow),
    meta: {
      total: (data ?? []).length,
      limit,
      includeInactive,
      search,
    },
  });
}

async function createGroup(request, response, actorId) {
  const body = getRequestBody(request);
  const validated = validateGroupPayload(body);
  if (validated.error) {
    sendJson(response, 400, { error: validated.error });
    return;
  }

  const payload = validated.value;
  const groupCode = buildGroupCode(payload.level, payload.grade, payload.subject);
  const serviceClient = getAdminServiceClient();

  const insertRow = {
    group_code: groupCode,
    level: payload.level,
    grade: payload.grade,
    subject: payload.subject,
    display_name_en: payload.displayNameEn,
    display_name_zh_hant: payload.displayNameZhHant || payload.displayNameEn,
    locale: payload.locale,
    is_active: payload.isActive,
    created_by: actorId || null,
  };

  const { data, error } = await serviceClient
    .from("word_groups")
    .insert(insertRow)
    .select(GROUP_COLUMNS.join(","))
    .single();

  if (error) {
    const message = String(error.message || "").toLowerCase();
    if (message.includes("duplicate") || message.includes("unique")) {
      sendJson(response, 409, { error: "Group already exists." });
      return;
    }
    throw new Error(error.message || "Failed to create group.");
  }

  sendJson(response, 201, { group: mapGroupRow(data) });
}

async function updateGroup(request, response) {
  const body = getRequestBody(request);
  const groupId = normalizeText(body.id);

  if (!groupId) {
    sendJson(response, 400, { error: "id is required." });
    return;
  }

  const serviceClient = getAdminServiceClient();
  const { data: existing, error: existingError } = await serviceClient
    .from("word_groups")
    .select(GROUP_COLUMNS.join(","))
    .eq("id", groupId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message || "Failed to load group.");
  }

  if (!existing) {
    sendJson(response, 404, { error: "Group not found." });
    return;
  }

  const mergedBody = {
    level: body.level ?? existing.level,
    grade: body.grade ?? existing.grade,
    subject: body.subject ?? existing.subject,
    displayNameEn: body.displayNameEn ?? existing.display_name_en,
    displayNameZhHant: body.displayNameZhHant ?? existing.display_name_zh_hant,
    locale: body.locale ?? existing.locale,
    isActive: typeof body.isActive === "undefined" ? existing.is_active : body.isActive,
  };

  const validated = validateGroupPayload(mergedBody, { allowPartial: true });
  if (validated.error) {
    sendJson(response, 400, { error: validated.error });
    return;
  }

  const payload = validated.value;
  const updateRow = {
    level: payload.level ?? existing.level,
    grade: payload.grade ?? existing.grade,
    subject: payload.subject ?? existing.subject,
    display_name_en: payload.displayNameEn ?? existing.display_name_en,
    display_name_zh_hant:
      payload.displayNameZhHant ?? existing.display_name_zh_hant ?? existing.display_name_en,
    locale: payload.locale ?? existing.locale ?? "zh-Hant",
    is_active: payload.hasActiveFlag ? payload.isActive : existing.is_active,
  };

  updateRow.group_code = buildGroupCode(updateRow.level, updateRow.grade, updateRow.subject);

  const { data, error } = await serviceClient
    .from("word_groups")
    .update(updateRow)
    .eq("id", groupId)
    .select(GROUP_COLUMNS.join(","))
    .single();

  if (error) {
    throw new Error(error.message || "Failed to update group.");
  }

  sendJson(response, 200, { group: mapGroupRow(data) });
}

export default async function handler(request, response) {
  try {
    const auth = await requireRole(request, ["owner", "admin"]);

    if (request.method === "GET") {
      await listGroups(request, response);
      return;
    }

    if (request.method === "POST") {
      await createGroup(request, response, auth.user?.id);
      return;
    }

    if (request.method === "PATCH") {
      await updateGroup(request, response);
      return;
    }

    sendJson(response, 405, { error: "Method not allowed." });
  } catch (error) {
    if (error?.statusCode) {
      sendAuthError(response, error);
      return;
    }

    sendJson(response, 500, { error: error.message || "Failed to manage word groups." });
  }
}
