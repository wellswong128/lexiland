function normalizeTermKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

function sanitizeMemoryTipsByLocale(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const sanitized = {};

  for (const [locale, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const tips = Array.isArray(entry.tips)
      ? entry.tips
          .filter((tip) => tip && typeof tip === "object")
          .map((tip) => ({
            method: String(tip.method ?? "").trim().slice(0, 200),
            content: String(tip.content ?? "").trim().slice(0, 4000),
          }))
          .filter((tip) => tip.method && tip.content)
      : [];

    if (tips.length > 0) {
      sanitized[String(locale).slice(0, 32)] = { tips };
    }
  }

  return sanitized;
}

function sanitizeMemoryImage(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const imageUrl = String(value.imageUrl ?? "").trim();
  if (!imageUrl || imageUrl.length > 2048) {
    return null;
  }

  const image = { imageUrl };
  if (value.publicId) {
    image.publicId = String(value.publicId).slice(0, 256);
  }

  return image;
}

export function mapMappedWordToWordsInsertRow(mappedWord, userId, now = new Date().toISOString()) {
  const term = String(mappedWord?.term ?? "").trim();
  const definition =
    String(mappedWord?.definition ?? "").trim() ||
    String(mappedWord?.translation ?? "").trim() ||
    term;

  if (!term || !definition) {
    return null;
  }

  return {
    user_id: userId,
    term,
    definition,
    translation: String(mappedWord?.translation ?? "").trim(),
    pronunciation: String(mappedWord?.pronunciation ?? "").trim(),
    part_of_speech: String(mappedWord?.partOfSpeech ?? "").trim(),
    example: String(mappedWord?.example ?? "").trim(),
    example_translation: String(mappedWord?.exampleTranslation ?? "").trim(),
    notes: "",
    tags: Array.isArray(mappedWord?.tags) ? mappedWord.tags.filter(Boolean) : [],
    source: "import",
    review_level: 0,
    next_review_at: now,
    last_reviewed_at: null,
    correct_count: 0,
    incorrect_count: 0,
    last_result: null,
    is_mistake: false,
    last_mistake_at: null,
    mistake_count: 0,
    memory_tips_by_locale: sanitizeMemoryTipsByLocale(mappedWord?.memoryTipsByLocale),
    memory_image: sanitizeMemoryImage(mappedWord?.memoryImage),
  };
}

export function mapWordRowToClient(row) {
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    review: {
      level: row.review_level,
      nextReviewAt: row.next_review_at,
      lastReviewedAt: row.last_reviewed_at,
      correctCount: row.correct_count,
      incorrectCount: row.incorrect_count,
      lastResult: row.last_result,
    },
    mistake: {
      isMistake: row.is_mistake,
      lastMistakeAt: row.last_mistake_at,
      mistakeCount: row.mistake_count,
    },
    memoryTipsByLocale: row.memory_tips_by_locale ?? {},
    memoryImage: row.memory_image ?? null,
  };
}

const WORD_INSERT_SELECT =
  "id,user_id,term,definition,translation,pronunciation,part_of_speech,example,example_translation,notes,tags,source,review_level,next_review_at,last_reviewed_at,correct_count,incorrect_count,last_result,is_mistake,last_mistake_at,mistake_count,memory_tips_by_locale,memory_image,created_at,updated_at";

const INSERT_BATCH_SIZE = 100;

export async function importMappedWordsForUser(
  rlsClient,
  userId,
  mappedWords,
  { limit = null } = {},
) {
  const { data: existingRows, error: existingError } = await rlsClient
    .from("words")
    .select("term")
    .eq("user_id", userId);

  if (existingError) {
    throw new Error(existingError.message || "Failed to load existing words.");
  }

  const existingTerms = new Set(
    (existingRows ?? []).map((row) => normalizeTermKey(row.term)).filter(Boolean),
  );

  const insertRows = [];

  for (const mappedWord of mappedWords ?? []) {
    const termKey = normalizeTermKey(mappedWord?.term);
    if (!termKey || existingTerms.has(termKey)) {
      continue;
    }

    const row = mapMappedWordToWordsInsertRow(mappedWord, userId);
    if (!row) {
      continue;
    }

    insertRows.push(row);
    existingTerms.add(termKey);

    if (limit != null && insertRows.length >= limit) {
      break;
    }
  }

  if (insertRows.length === 0) {
    const hadMissingWords = (mappedWords ?? []).some((mappedWord) => {
      const termKey = normalizeTermKey(mappedWord?.term);
      return termKey && !existingTerms.has(termKey);
    });

    if (hadMissingWords) {
      throw new Error(
        "Could not prepare group words for import. Check wordbase entries for this group.",
      );
    }

    return [];
  }

  const importedRows = [];
  let lastError = null;

  for (let index = 0; index < insertRows.length; index += INSERT_BATCH_SIZE) {
    const batch = insertRows.slice(index, index + INSERT_BATCH_SIZE);
    const { data, error } = await rlsClient.from("words").insert(batch).select(WORD_INSERT_SELECT);

    if (error) {
      lastError = error;

      for (const row of batch) {
        const { data: single, error: singleError } = await rlsClient
          .from("words")
          .insert(row)
          .select(WORD_INSERT_SELECT)
          .single();

        if (!singleError && single) {
          importedRows.push(single);
        } else if (singleError) {
          lastError = singleError;
        }
      }
    } else {
      importedRows.push(...(data ?? []));
    }
  }

  if (importedRows.length === 0) {
    throw new Error(
      lastError?.message || "Could not save group words to your word list.",
    );
  }

  return importedRows.map(mapWordRowToClient);
}
