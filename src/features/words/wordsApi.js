import { supabase } from "../../lib/supabaseClient.js";
import { toSupabaseSource } from "./wordTypes.js";

const WORD_LIST_COLUMNS = `
  id,
  user_id,
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
  review_level,
  next_review_at,
  last_reviewed_at,
  correct_count,
  incorrect_count,
  last_result,
  is_mistake,
  last_mistake_at,
  mistake_count,
  created_at,
  updated_at
`;

const WORD_COLUMNS = `
  ${WORD_LIST_COLUMNS.trim()},
  memory_tips_by_locale,
  memory_image
`;

function mapDbWordToWord(row) {
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

function mapWordToInsert(word, userId) {
  return mapWordToDbRow(word, userId);
}

export function mapWordToDbRow(word, userId) {
  return {
    user_id: userId,
    term: word.term,
    definition: word.definition,
    translation: word.translation,
    pronunciation: word.pronunciation,
    part_of_speech: word.partOfSpeech,
    example: word.example,
    example_translation: word.exampleTranslation,
    notes: word.notes,
    tags: word.tags,
    source: toSupabaseSource(word.source),
    review_level: word.review.level,
    next_review_at: word.review.nextReviewAt,
    last_reviewed_at: word.review.lastReviewedAt,
    correct_count: word.review.correctCount,
    incorrect_count: word.review.incorrectCount,
    last_result: word.review.lastResult,
    is_mistake: word.mistake.isMistake,
    last_mistake_at: word.mistake.lastMistakeAt,
    mistake_count: word.mistake.mistakeCount,
    memory_tips_by_locale: word.memoryTipsByLocale ?? {},
    memory_image: word.memoryImage ?? null,
  };
}

export function mapWordChangesToUpdate(changes) {
  const update = {};

  if (Object.hasOwn(changes, "term")) update.term = changes.term;
  if (Object.hasOwn(changes, "definition")) update.definition = changes.definition;
  if (Object.hasOwn(changes, "translation")) update.translation = changes.translation;
  if (Object.hasOwn(changes, "pronunciation")) update.pronunciation = changes.pronunciation;
  if (Object.hasOwn(changes, "partOfSpeech")) update.part_of_speech = changes.partOfSpeech;
  if (Object.hasOwn(changes, "example")) update.example = changes.example;
  if (Object.hasOwn(changes, "exampleTranslation")) {
    update.example_translation = changes.exampleTranslation;
  }
  if (Object.hasOwn(changes, "notes")) update.notes = changes.notes;
  if (Object.hasOwn(changes, "tags")) update.tags = changes.tags;
  if (Object.hasOwn(changes, "source")) update.source = toSupabaseSource(changes.source);

  if (changes.review) {
    update.review_level = changes.review.level;
    update.next_review_at = changes.review.nextReviewAt;
    update.last_reviewed_at = changes.review.lastReviewedAt;
    update.correct_count = changes.review.correctCount;
    update.incorrect_count = changes.review.incorrectCount;
    update.last_result = changes.review.lastResult;
  }

  if (changes.mistake) {
    update.is_mistake = changes.mistake.isMistake;
    update.last_mistake_at = changes.mistake.lastMistakeAt;
    update.mistake_count = changes.mistake.mistakeCount;
  }

  if (Object.hasOwn(changes, "memoryTipsByLocale")) {
    update.memory_tips_by_locale = changes.memoryTipsByLocale ?? {};
  }

  if (Object.hasOwn(changes, "memoryImage")) {
    update.memory_image = changes.memoryImage ?? null;
  }

  return update;
}

function ensureSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
}

export async function fetchWordsFromSupabase(userId, { includeMemory = false } = {}) {
  ensureSupabase();

  const columns = includeMemory ? WORD_COLUMNS : WORD_LIST_COLUMNS;
  const { data, error } = await supabase
    .from("words")
    .select(columns)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data.map(mapDbWordToWord);
}

const INSERT_BATCH_SIZE = 500;

export async function insertWordInSupabase(word, userId) {
  ensureSupabase();

  const { data, error } = await supabase
    .from("words")
    .insert(mapWordToInsert(word, userId))
    .select(WORD_COLUMNS)
    .single();

  if (error) throw error;

  return mapDbWordToWord(data);
}

export async function insertWordsInSupabase(words, userId) {
  ensureSupabase();

  if (!Array.isArray(words) || words.length === 0) {
    return [];
  }

  const batches = [];
  for (let index = 0; index < words.length; index += INSERT_BATCH_SIZE) {
    batches.push(words.slice(index, index + INSERT_BATCH_SIZE));
  }

  const batchResults = await Promise.all(
    batches.map(async (batch) => {
      const { data, error } = await supabase
        .from("words")
        .insert(batch.map((word) => mapWordToInsert(word, userId)))
        .select(WORD_COLUMNS);

      if (error) {
        // Fallback: insert one by one to skip duplicates
        const saved = [];
        for (const word of batch) {
          try {
            saved.push(await insertWordInSupabase(word, userId));
          } catch {
            // Skip invalid or duplicate terms.
          }
        }
        return saved;
      }

      return data.map(mapDbWordToWord);
    }),
  );

  return batchResults.flat();
}

export async function updateWordInSupabase(wordId, changes) {
  ensureSupabase();

  const { data, error } = await supabase
    .from("words")
    .update(mapWordChangesToUpdate(changes))
    .eq("id", wordId)
    .select(WORD_COLUMNS)
    .single();

  if (error) throw error;

  return mapDbWordToWord(data);
}

const MEMORY_UPDATE_CONCURRENCY = 8;

async function runWithConcurrency(items, worker, concurrency) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

export async function batchUpdateWordMemoryInSupabase(updates) {
  ensureSupabase();

  if (!Array.isArray(updates) || updates.length === 0) {
    return [];
  }

  const results = [];

  await runWithConcurrency(updates, async ({ wordId, changes }) => {
    try {
      const { data, error } = await supabase
        .from("words")
        .update(mapWordChangesToUpdate(changes))
        .eq("id", wordId)
        .select(WORD_COLUMNS)
        .single();

      if (error) throw error;
      results.push(mapDbWordToWord(data));
    } catch (error) {
      // Skip failed updates and continue.
    }
  }, MEMORY_UPDATE_CONCURRENCY);

  return results;
}

export async function deleteWordFromSupabase(wordId) {
  ensureSupabase();

  const { error } = await supabase.from("words").delete().eq("id", wordId);

  if (error) throw error;
}

export async function deleteAllWordsFromSupabase(userId) {
  ensureSupabase();

  const { error } = await supabase.from("words").delete().eq("user_id", userId);

  if (error) throw error;
}
