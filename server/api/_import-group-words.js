function normalizeTermKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

function isDuplicateTermError(error) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "").toLowerCase();
  return code === "23505" || message.includes("words_user_term_unique");
}

const WORD_INSERT_SELECT =
  "id,user_id,term,definition,translation,pronunciation,part_of_speech,example,example_translation,notes,tags,source,review_level,next_review_at,last_reviewed_at,correct_count,incorrect_count,last_result,is_mistake,last_mistake_at,mistake_count,memory_tips_by_locale,memory_image,created_at,updated_at";

function hasMemoryTipsValue(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  return Array.isArray(value.tips) && value.tips.some(
    (tip) => String(tip?.method ?? "").trim() && String(tip?.content ?? "").trim(),
  );
}

function buildMemoryBackfillUpdate(existingRow, mappedWord) {
  const update = {};
  const mappedTips = sanitizeMemoryTipsByLocale(mappedWord?.memoryTipsByLocale);
  const mappedImage = sanitizeMemoryImage(mappedWord?.memoryImage);
  const existingTips = existingRow.memory_tips_by_locale ?? {};
  const mergedTips = { ...existingTips };
  let tipsDirty = false;

  for (const [locale, tips] of Object.entries(mappedTips)) {
    if (!hasMemoryTipsValue(existingTips[locale]) && hasMemoryTipsValue(tips)) {
      mergedTips[locale] = tips;
      tipsDirty = true;
    }
  }

  if (tipsDirty) {
    update.memory_tips_by_locale = mergedTips;
  }

  if (!sanitizeMemoryImage(existingRow.memory_image) && mappedImage) {
    update.memory_image = mappedImage;
  }

  return Object.keys(update).length > 0 ? update : null;
}

function buildMappedWordsByTerm(mappedWords) {
  const mappedByTerm = new Map();

  for (const mappedWord of mappedWords ?? []) {
    const termKey = normalizeTermKey(mappedWord?.term);
    if (termKey && !mappedByTerm.has(termKey)) {
      mappedByTerm.set(termKey, mappedWord);
    }
  }

  return mappedByTerm;
}

async function backfillExistingWordMemory(rlsClient, existingRows, mappedWords) {
  const mappedByTerm = buildMappedWordsByTerm(mappedWords);
  const updatedRows = [];

  for (const row of existingRows) {
    const termKey = normalizeTermKey(row.term);
    const mappedWord = termKey ? mappedByTerm.get(termKey) : null;
    if (!mappedWord) {
      continue;
    }

    const update = buildMemoryBackfillUpdate(row, mappedWord);
    if (!update) {
      continue;
    }

    const { data, error } = await rlsClient
      .from("words")
      .update(update)
      .eq("id", row.id)
      .select(WORD_INSERT_SELECT)
      .single();

    if (!error && data) {
      updatedRows.push(data);
    }
  }

  return updatedRows;
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

  const imageUrl = String(value.imageUrl ?? value.url ?? "").trim();
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
    memoryImage: sanitizeMemoryImage(row.memory_image),
  };
}

const INSERT_BATCH_SIZE = 100;
const EXISTING_WORDS_PAGE_SIZE = 1000;

async function fetchExistingWordsByUser(rlsClient, userId) {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await rlsClient
      .from("words")
      .select(WORD_INSERT_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, from + EXISTING_WORDS_PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message || "Failed to load existing words.");
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < EXISTING_WORDS_PAGE_SIZE) {
      break;
    }

    from += EXISTING_WORDS_PAGE_SIZE;
  }

  return rows;
}

function buildExistingWordsByTerm(rows) {
  const existingByTerm = new Map();

  for (const row of rows) {
    const termKey = normalizeTermKey(row.term);
    if (termKey && !existingByTerm.has(termKey)) {
      existingByTerm.set(termKey, row);
    }
  }

  return existingByTerm;
}

function collectMappedWordsForTerms(mappedWords, existingByTerm, excludeTermKeys = new Set()) {
  const matched = [];
  const seen = new Set(excludeTermKeys);

  for (const mappedWord of mappedWords ?? []) {
    const termKey = normalizeTermKey(mappedWord?.term);
    if (!termKey || seen.has(termKey)) {
      continue;
    }

    const existingRow = existingByTerm.get(termKey);
    if (existingRow) {
      matched.push(existingRow);
      seen.add(termKey);
    }
  }

  return matched;
}

export async function importMappedWordsForUser(
  rlsClient,
  userId,
  mappedWords,
  { limit = null } = {},
) {
  const existingRows = await fetchExistingWordsByUser(rlsClient, userId);
  const existingByTerm = buildExistingWordsByTerm(existingRows);

  const insertRows = [];
  const pendingInsertKeys = new Set();

  for (const mappedWord of mappedWords ?? []) {
    const termKey = normalizeTermKey(mappedWord?.term);
    if (!termKey || existingByTerm.has(termKey) || pendingInsertKeys.has(termKey)) {
      continue;
    }

    const row = mapMappedWordToWordsInsertRow(mappedWord, userId);
    if (!row) {
      continue;
    }

    const insertKey = normalizeTermKey(row.term);
    if (!insertKey || pendingInsertKeys.has(insertKey)) {
      continue;
    }

    insertRows.push(row);
    pendingInsertKeys.add(insertKey);

    if (limit != null && insertRows.length >= limit) {
      break;
    }
  }

  const importedRows = [];

  if (insertRows.length > 0) {
    let lastNonDuplicateError = null;

    for (let index = 0; index < insertRows.length; index += INSERT_BATCH_SIZE) {
      const batch = insertRows.slice(index, index + INSERT_BATCH_SIZE);
      const { data, error } = await rlsClient.from("words").insert(batch).select(WORD_INSERT_SELECT);

      if (error) {
        for (const row of batch) {
          const { data: single, error: singleError } = await rlsClient
            .from("words")
            .insert(row)
            .select(WORD_INSERT_SELECT)
            .single();

          if (!singleError && single) {
            importedRows.push(single);
            const termKey = normalizeTermKey(single.term);
            if (termKey) {
              existingByTerm.set(termKey, single);
            }
            continue;
          }

          if (isDuplicateTermError(singleError)) {
            const termKey = normalizeTermKey(row.term);
            const existingRow = termKey ? existingByTerm.get(termKey) : null;
            if (existingRow) {
              importedRows.push(existingRow);
            }
            continue;
          }

          if (singleError) {
            lastNonDuplicateError = singleError;
          }
        }
      } else {
        for (const row of data ?? []) {
          importedRows.push(row);
          const termKey = normalizeTermKey(row.term);
          if (termKey) {
            existingByTerm.set(termKey, row);
          }
        }
      }
    }

    const importedKeys = new Set(
      importedRows.map((row) => normalizeTermKey(row.term)).filter(Boolean),
    );
    const stillMissing = insertRows.filter(
      (row) => !importedKeys.has(normalizeTermKey(row.term)),
    );

    if (stillMissing.length > 0 && importedRows.length === 0 && lastNonDuplicateError) {
      throw new Error(
        lastNonDuplicateError.message || "Could not save group words to your word list.",
      );
    }
  }

  const importedKeys = new Set(
    importedRows.map((row) => normalizeTermKey(row.term)).filter(Boolean),
  );
  const alreadyOwnedRows = collectMappedWordsForTerms(mappedWords, existingByTerm, importedKeys);
  const backfilledRows = await backfillExistingWordMemory(
    rlsClient,
    alreadyOwnedRows,
    mappedWords,
  );

  for (const row of backfilledRows) {
    const termKey = normalizeTermKey(row.term);
    if (termKey) {
      existingByTerm.set(termKey, row);
    }
  }

  const unresolvedMappedWords = (mappedWords ?? []).filter((mappedWord) => {
    const termKey = normalizeTermKey(mappedWord?.term);
    return termKey && !existingByTerm.has(termKey);
  });

  if (
    unresolvedMappedWords.length > 0 &&
    importedRows.length === 0 &&
    alreadyOwnedRows.length === 0
  ) {
    throw new Error(
      "Could not prepare group words for import. Check wordbase entries for this group.",
    );
  }

  const affectedTermKeys = new Set([
    ...importedRows.map((row) => normalizeTermKey(row.term)).filter(Boolean),
    ...alreadyOwnedRows.map((row) => normalizeTermKey(row.term)).filter(Boolean),
  ]);

  return [...affectedTermKeys]
    .map((termKey) => existingByTerm.get(termKey))
    .filter(Boolean)
    .map(mapWordRowToClient);
}

export async function syncGroupWordMemoryForUser(
  rlsClient,
  userId,
  mappedWords,
  { terms = null } = {},
) {
  const existingRows = await fetchExistingWordsByUser(rlsClient, userId);
  const existingByTerm = buildExistingWordsByTerm(existingRows);
  let rowsToBackfill = [];

  if (Array.isArray(terms) && terms.length > 0) {
    const termKeys = new Set(terms.map((term) => normalizeTermKey(term)).filter(Boolean));
    rowsToBackfill = existingRows.filter((row) => termKeys.has(normalizeTermKey(row.term)));
  } else {
    rowsToBackfill = collectMappedWordsForTerms(mappedWords, existingByTerm, new Set());
  }

  const backfilledRows = await backfillExistingWordMemory(
    rlsClient,
    rowsToBackfill,
    mappedWords,
  );

  for (const row of backfilledRows) {
    const termKey = normalizeTermKey(row.term);
    if (termKey) {
      existingByTerm.set(termKey, row);
    }
  }

  return rowsToBackfill
    .map((row) => existingByTerm.get(normalizeTermKey(row.term)) ?? row)
    .map(mapWordRowToClient);
}
