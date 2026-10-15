import assert from "node:assert/strict";
import { test } from "node:test";

import { importMappedWordsForUser } from "./_import-group-words.js";

const USER_ID = "user-1";
const NOW = "2026-06-29T11:00:00.000Z";

function mappedWord(term) {
  return {
    term,
    definition: `${term} definition`,
    translation: `${term} translation`,
  };
}

function savedWordRow(term, overrides = {}) {
  const key = term.toLowerCase();

  return {
    id: `word-${key}`,
    user_id: USER_ID,
    term,
    definition: `${term} definition`,
    translation: `${term} translation`,
    pronunciation: "",
    part_of_speech: "",
    example: "",
    example_translation: "",
    notes: "",
    tags: [],
    source: "import",
    review_level: 0,
    next_review_at: NOW,
    last_reviewed_at: null,
    correct_count: 0,
    incorrect_count: 0,
    last_result: null,
    is_mistake: false,
    last_mistake_at: null,
    mistake_count: 0,
    memory_tips_by_locale: {},
    memory_image: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function createMockRlsClient({
  batchInsertResult,
  existingRowsByFetch = [[]],
  singleInsertResults = [],
}) {
  let existingFetchIndex = 0;
  const insertAttempts = [];

  return {
    insertAttempts,
    from(table) {
      assert.equal(table, "words");

      return {
        select() {
          return {
            eq(column, userId) {
              assert.equal(column, "user_id");
              assert.equal(userId, USER_ID);

              return {
                order(columnName, options) {
                  assert.equal(columnName, "created_at");
                  assert.deepEqual(options, { ascending: false });

                  return {
                    range() {
                      const rows =
                        existingRowsByFetch[
                          Math.min(existingFetchIndex, existingRowsByFetch.length - 1)
                        ] ?? [];
                      existingFetchIndex += 1;

                      return Promise.resolve({ data: rows, error: null });
                    },
                  };
                },
              };
            },
          };
        },
        insert(rows) {
          insertAttempts.push(rows);

          return {
            select() {
              if (Array.isArray(rows)) {
                return Promise.resolve(batchInsertResult);
              }

              return {
                single() {
                  return Promise.resolve(
                    singleInsertResults.shift() ?? {
                      data: savedWordRow(rows.term),
                      error: null,
                    },
                  );
                },
              };
            },
          };
        },
      };
    },
  };
}

test("throws when a fallback insert partially fails", async () => {
  const rlsClient = createMockRlsClient({
    batchInsertResult: { data: null, error: { message: "batch failed" } },
    singleInsertResults: [
      { data: savedWordRow("alpha"), error: null },
      { data: null, error: { code: "42501", message: "row policy rejected beta" } },
    ],
  });

  await assert.rejects(
    () =>
      importMappedWordsForUser(rlsClient, USER_ID, [
        mappedWord("alpha"),
        mappedWord("beta"),
      ]),
    /row policy rejected beta/,
  );
});

test("resolves duplicate insert races by refreshing existing words", async () => {
  const rlsClient = createMockRlsClient({
    batchInsertResult: { data: null, error: { message: "batch failed" } },
    existingRowsByFetch: [[], [savedWordRow("beta", { id: "existing-beta" })]],
    singleInsertResults: [
      {
        data: null,
        error: { code: "23505", message: "duplicate key value violates words_user_term_unique" },
      },
    ],
  });

  const importedWords = await importMappedWordsForUser(rlsClient, USER_ID, [
    mappedWord("beta"),
  ]);

  assert.deepEqual(
    importedWords.map((word) => ({ id: word.id, term: word.term })),
    [{ id: "existing-beta", term: "beta" }],
  );
});
