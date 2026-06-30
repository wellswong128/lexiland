import {
  containsChinese,
  pickChineseText,
} from "../../../lib/vocabularyLocale.js";
import { hasSupabaseConfig, supabase } from "../../lib/supabaseClient.js";
import { normalizeTerm } from "./wordTypes.js";

const WORDBASE_COLUMNS = `
  id,
  contributor_id,
  term_key,
  term,
  definition,
  translation,
  pronunciation,
  part_of_speech,
  example,
  example_translation,
  notes,
  tags,
  source,
  memory_tips_by_locale,
  memory_image,
  created_at,
  updated_at
`;

function ensureSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
}

function mapWordbaseRow(row) {
  return {
    id: row.id,
    term: row.term,
    definition: row.definition,
    translation: row.translation ?? "",
    pronunciation: row.pronunciation ?? "",
    partOfSpeech: row.part_of_speech ?? "",
    example: row.example ?? "",
    exampleTranslation: row.example_translation ?? "",
    notes: row.notes ?? "",
    tags: row.tags ?? [],
    source: row.source,
    memoryTipsByLocale: row.memory_tips_by_locale ?? {},
    memoryImage: row.memory_image ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function defaultWordbaseReviewFields() {
  return {
    review_level: 0,
    next_review_at: new Date().toISOString(),
    last_reviewed_at: null,
    correct_count: 0,
    incorrect_count: 0,
    last_result: null,
    is_mistake: false,
    last_mistake_at: null,
    mistake_count: 0,
  };
}

function stripSavedAt(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  const { savedAt: _savedAt, ...rest } = value;

  return rest;
}

export function canUseWordbase(user) {
  return hasSupabaseConfig && Boolean(user?.id);
}

export function wordbaseEntryToSuggestion(entry) {
  return {
    term: entry.term,
    definition: entry.definition,
    translation: entry.translation,
    pronunciation: entry.pronunciation,
    partOfSpeech: entry.partOfSpeech,
    example: entry.example,
    exampleTranslation: entry.exampleTranslation,
    tags: Array.isArray(entry.tags) ? entry.tags : [],
  };
}

export function hasWordbaseDetails(entry) {
  return Boolean(entry?.definition?.trim() && containsChinese(entry?.translation));
}

export function hasWordbaseMemoryTips(entry, locale) {
  const tips = stripSavedAt(entry?.memoryTipsByLocale?.[locale]);

  return Array.isArray(tips?.tips) && tips.tips.length > 0;
}

export function hasWordbaseMemoryImage(entry) {
  return Boolean(entry?.memoryImage?.imageUrl);
}

export async function fetchWordbaseEntry(term) {
  if (!hasSupabaseConfig || !supabase) {
    return null;
  }

  const termKey = normalizeTerm(term);

  if (!termKey) {
    return null;
  }

  const { data, error } = await supabase
    .from("wordbase")
    .select(WORDBASE_COLUMNS)
    .eq("term_key", termKey)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapWordbaseRow(data) : null;
}

function resolveUpsertTerm(requestedTerm, suggestionTerm, existingTerm = "") {
  const requested = String(requestedTerm ?? "").trim();
  const suggestion = String(suggestionTerm ?? "").trim();
  const existing = String(existingTerm ?? "").trim();
  const canonical = existing || requested;

  if (!canonical) {
    return suggestion;
  }
  if (!suggestion) {
    return canonical;
  }
  if (normalizeTerm(suggestion) === normalizeTerm(canonical)) {
    return canonical;
  }
  if (canonical.split(/\s+/).length > 1 && suggestion.split(/\s+/).length <= 1) {
    return canonical;
  }

  return suggestion;
}

function buildWordDetailsRow(suggestion, contributorId, existing = null) {
  const resolvedTerm = resolveUpsertTerm(
    existing?.term ?? suggestion.term,
    suggestion.term,
    existing?.term ?? "",
  );
  const termKey = normalizeTerm(resolvedTerm);

  return {
    contributor_id: contributorId,
    term_key: termKey,
    term: resolvedTerm.trim(),
    definition: suggestion.definition?.trim() || existing?.definition || "",
    translation: pickChineseText(
      suggestion.translation,
      existing?.translation,
      resolvedTerm,
    ),
    pronunciation: suggestion.pronunciation ?? existing?.pronunciation ?? "",
    part_of_speech: suggestion.partOfSpeech ?? existing?.partOfSpeech ?? "",
    example: suggestion.example ?? existing?.example ?? "",
    example_translation: pickChineseText(
      suggestion.exampleTranslation,
      existing?.exampleTranslation,
      resolvedTerm,
    ),
    notes: existing?.notes ?? "",
    tags: Array.isArray(suggestion.tags)
      ? suggestion.tags
      : (existing?.tags ?? []),
    source: "ai",
    memory_tips_by_locale: existing?.memoryTipsByLocale ?? {},
    memory_image: existing?.memoryImage ?? null,
  };
}

function buildWordContextRow(word, contributorId, existing = null) {
  return buildWordDetailsRow(
    {
      term: word.term,
      definition: word.definition,
      translation: word.translation,
      pronunciation: word.pronunciation,
      partOfSpeech: word.partOfSpeech,
      example: word.example,
      exampleTranslation: word.exampleTranslation,
      tags: word.tags,
    },
    contributorId,
    existing,
  );
}

async function upsertWordbaseRow(row, existingId = null) {
  ensureSupabase();

  if (existingId) {
    const { error } = await supabase.from("wordbase").update(row).eq("id", existingId);

    if (error) {
      throw error;
    }

    return existingId;
  }

  const { data: existing, error: lookupError } = await supabase
    .from("wordbase")
    .select("id")
    .eq("term_key", row.term_key)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (existing?.id) {
    const { error } = await supabase.from("wordbase").update(row).eq("id", existing.id);

    if (error) {
      throw error;
    }

    return existing.id;
  }

  const { data, error } = await supabase
    .from("wordbase")
    .insert({
      ...defaultWordbaseReviewFields(),
      ...row,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id;
}

export async function contributeWordDetailsFromSuggestion(suggestion, contributorId) {
  if (!canUseWordbase({ id: contributorId })) {
    return;
  }

  const termKey = normalizeTerm(suggestion.term);

  if (!termKey || !suggestion.definition?.trim()) {
    return;
  }

  const existing = await fetchWordbaseEntry(suggestion.term);
  const row = buildWordDetailsRow(suggestion, contributorId, existing);

  await upsertWordbaseRow(row, existing?.id ?? null);
}

export async function contributeMemoryTipsToWordbase(word, locale, memoryTips, contributorId) {
  if (!canUseWordbase({ id: contributorId }) || !memoryTips) {
    return;
  }

  const termKey = normalizeTerm(word.term);

  if (!termKey) {
    return;
  }

  const existing = await fetchWordbaseEntry(word.term);
  const memoryTipsByLocale = {
    ...(existing?.memoryTipsByLocale ?? {}),
    [locale]: {
      ...memoryTips,
      savedAt: new Date().toISOString(),
    },
  };
  const row = {
    ...buildWordContextRow(word, contributorId, existing),
    memory_tips_by_locale: memoryTipsByLocale,
    memory_image: existing?.memoryImage ?? null,
  };

  await upsertWordbaseRow(row);
}

export async function contributeMemoryImageToWordbase(word, memoryImage, contributorId) {
  if (!canUseWordbase({ id: contributorId }) || !memoryImage?.imageUrl) {
    return;
  }

  const existing = await fetchWordbaseEntry(word.term);
  const row = {
    ...buildWordContextRow(word, contributorId, existing),
    memory_tips_by_locale: existing?.memoryTipsByLocale ?? {},
    memory_image: {
      ...memoryImage,
      savedAt: new Date().toISOString(),
    },
  };

  await upsertWordbaseRow(row);
}
