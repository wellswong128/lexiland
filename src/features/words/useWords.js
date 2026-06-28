import { useCallback, useEffect, useRef, useState } from "react";
import { hasSupabaseConfig } from "../../lib/supabaseClient.js";
import { clearLearningActivity } from "../../lib/learningActivity.js";
import {
  clearAllStoredWordAiMemory,
  clearStoredWordAiMemory,
  hydrateWordsAiMemory,
} from "../../lib/wordAiMemoryStorage.js";
import { clearMemoryTipsCache } from "./memoryTipsApi.js";
import { clearWordImageCache } from "./wordImageApi.js";
import {
  loadWords,
  loadWordsForUser,
  resetWords,
  resetWordsForUser,
  saveWords,
  saveWordsForUser,
} from "../../lib/storage.js";
import {
  createInitialMistake,
  createInitialReview,
  createWord,
  getCurrentIsoDate,
  normalizeTags,
  normalizeTerm,
  normalizeText,
  WORD_SOURCES,
  toSupabaseSource,
} from "./wordTypes.js";
import {
  deleteAllWordsFromSupabase,
  deleteWordFromSupabase,
  fetchWordsFromSupabase,
  insertWordInSupabase,
  insertWordsInSupabase,
  mapWordChangesToUpdate,
  updateWordInSupabase,
  batchUpdateWordMemoryInSupabase,
} from "./wordsApi.js";
import {
  ACTIVE_GROUP_INITIAL_IMPORT_COUNT,
  fetchUserActiveGroupWords,
  invalidateUserActiveGroupWordsCache,
} from "../wordGroups/wordGroupsApi.js";
import { saveCachedActiveGroupScope, loadCachedActiveGroupScope } from "../wordGroups/activeGroupScopeCache.js";
import { ACTIVE_GROUP_CHANGED_EVENT } from "../wordGroups/wordGroupScopeEvents.js";
import { syncActiveGroupWordMemory } from "../wordGroups/syncActiveGroupWordMemory.js";
import { WORD_SCOPE_MODE_CHANGED_EVENT, loadWordScopeMode, WORD_SCOPE_MODES } from "../wordGroups/wordScopeMode.js";

function normalizeWordChanges(changes) {
  const normalizedChanges = { ...changes };

  if (Object.hasOwn(normalizedChanges, "term")) {
    normalizedChanges.term = normalizeText(normalizedChanges.term);
  }

  if (Object.hasOwn(normalizedChanges, "definition")) {
    normalizedChanges.definition = normalizeText(normalizedChanges.definition);
  }

  if (Object.hasOwn(normalizedChanges, "translation")) {
    normalizedChanges.translation = normalizeText(normalizedChanges.translation);
  }

  if (Object.hasOwn(normalizedChanges, "pronunciation")) {
    normalizedChanges.pronunciation = normalizeText(normalizedChanges.pronunciation);
  }

  if (Object.hasOwn(normalizedChanges, "partOfSpeech")) {
    normalizedChanges.partOfSpeech = normalizeText(normalizedChanges.partOfSpeech);
  }

  if (Object.hasOwn(normalizedChanges, "example")) {
    normalizedChanges.example = normalizeText(normalizedChanges.example);
  }

  if (Object.hasOwn(normalizedChanges, "exampleTranslation")) {
    normalizedChanges.exampleTranslation = normalizeText(
      normalizedChanges.exampleTranslation,
    );
  }

  if (Object.hasOwn(normalizedChanges, "notes")) {
    normalizedChanges.notes = normalizeText(normalizedChanges.notes);
  }

  if (Object.hasOwn(normalizedChanges, "tags")) {
    normalizedChanges.tags = normalizeTags(normalizedChanges.tags);
  }

  if (Object.hasOwn(normalizedChanges, "memoryTipsByLocale")) {
    normalizedChanges.memoryTipsByLocale = {
      ...(normalizedChanges.memoryTipsByLocale ?? {}),
    };
  }

  if (Object.hasOwn(normalizedChanges, "memoryImage")) {
    normalizedChanges.memoryImage = normalizedChanges.memoryImage ?? null;
  }

  return normalizedChanges;
}

function applyWordChanges(word, changes) {
  return {
    ...word,
    ...changes,
    id: word.id,
    createdAt: word.createdAt,
    memoryTipsByLocale: changes.memoryTipsByLocale
      ? {
          ...(word.memoryTipsByLocale ?? {}),
          ...changes.memoryTipsByLocale,
        }
      : word.memoryTipsByLocale,
    memoryImage:
      Object.hasOwn(changes, "memoryImage") ? changes.memoryImage : word.memoryImage,
    review: changes.review ? { ...word.review, ...changes.review } : word.review,
    mistake: changes.mistake
      ? { ...word.mistake, ...changes.mistake }
      : word.mistake,
  };
}

function hydrateWords(words, storage) {
  return hydrateWordsAiMemory(words, storage);
}

function mergeWordsPreservingMemory(remoteWords, existingWords) {
  if (!Array.isArray(existingWords) || existingWords.length === 0) {
    return remoteWords;
  }

  const existingById = new Map(existingWords.map((word) => [word.id, word]));
  const remoteTerms = new Set(
    remoteWords.map((word) => normalizeTerm(word.term)).filter(Boolean),
  );

  const mergedRemote = remoteWords.map((word) => {
    const existing = existingById.get(word.id);
    if (!existing) {
      return word;
    }

    return {
      ...word,
      memoryTipsByLocale: {
        ...(existing.memoryTipsByLocale ?? {}),
        ...(word.memoryTipsByLocale ?? {}),
      },
      memoryImage: word.memoryImage ?? existing.memoryImage ?? null,
    };
  });

  const localOnlyWords = existingWords.filter(
    (word) => !remoteTerms.has(normalizeTerm(word.term)),
  );

  return [...mergedRemote, ...localOnlyWords];
}

function splitWordChanges(changes) {
  const { memoryTipsByLocale, memoryImage, ...remoteChanges } = changes;

  return {
    remoteChanges,
    memoryTipsByLocale,
    memoryImage,
  };
}

function mergeWordAiMemory(word, sourceWord) {
  return {
    ...word,
    memoryTipsByLocale: sourceWord.memoryTipsByLocale ?? word.memoryTipsByLocale,
    memoryImage: sourceWord.memoryImage ?? word.memoryImage,
  };
}

function hasRemoteWordChanges(changes) {
  return Object.keys(mapWordChangesToUpdate(changes)).length > 0;
}

async function importMissingActiveGroupWords(
  userId,
  existingWords,
  preloadedPayload = null,
  { limit = null, wordLimit = 0, forceRefresh = false } = {},
) {
  let payload = preloadedPayload;
  const payloadHasWords =
    Array.isArray(payload?.mappedWords) && payload.mappedWords.length > 0;

  if (!payloadHasWords) {
    payload = await fetchUserActiveGroupWords({
      includeWords: true,
      wordLimit: wordLimit > 0 ? wordLimit : 0,
      forceRefresh,
    });
  }

  const mappedWords = Array.isArray(payload.mappedWords) ? payload.mappedWords : [];

  if (!payload.activeGroup) {
    return {
      activeGroup: null,
      importedWords: [],
      mappedWords,
    };
  }

  if (userId) {
    saveCachedActiveGroupScope(userId, {
      activeGroup: payload.activeGroup,
      mappedTerms: Array.isArray(payload.mappedTerms) ? payload.mappedTerms : [],
    });
  }

  if (mappedWords.length === 0) {
    return {
      activeGroup: payload.activeGroup ?? null,
      importedWords: [],
      mappedWords,
    };
  }

  const existingTerms = new Set(existingWords.map((word) => normalizeTerm(word.term)));
  const drafts = [];

  for (const sourceWord of mappedWords) {
    const term = normalizeText(sourceWord?.term);
    const definition = normalizeText(sourceWord?.definition);
    const termKey = normalizeTerm(term);
    if (!termKey || !definition || existingTerms.has(termKey)) {
      continue;
    }

    if (limit != null && drafts.length >= limit) {
      break;
    }

    drafts.push(
      createWord(
        {
          term,
          definition,
          translation: normalizeText(sourceWord?.translation),
          pronunciation: normalizeText(sourceWord?.pronunciation),
          partOfSpeech: normalizeText(sourceWord?.partOfSpeech),
          example: normalizeText(sourceWord?.example),
          exampleTranslation: normalizeText(sourceWord?.exampleTranslation),
          tags: normalizeTags(sourceWord?.tags),
          memoryTipsByLocale:
            sourceWord?.memoryTipsByLocale && typeof sourceWord.memoryTipsByLocale === "object"
              ? sourceWord.memoryTipsByLocale
              : {},
          memoryImage:
            sourceWord?.memoryImage && typeof sourceWord.memoryImage === "object"
              ? sourceWord.memoryImage
              : null,
        },
        {
          source: WORD_SOURCES.IMPORT,
        },
      ),
    );
    existingTerms.add(termKey);
  }

  const savedWords = drafts.length > 0 ? await insertWordsInSupabase(drafts, userId) : [];

  return {
    activeGroup: payload.activeGroup ?? null,
    importedWords: savedWords,
    mappedWords,
  };
}

function buildAutoImportedNotice(activeGroup) {
  return {
    count: 0,
    groupCode: activeGroup.groupCode ?? "",
    groupNameEn: activeGroup.displayNameEn ?? "",
    groupNameZhHant: activeGroup.displayNameZhHant ?? "",
  };
}

let activeGroupSyncPending = false;
let activeGroupSyncChain = null;
let queuedScopePayload = null;
let lastActiveGroupAutoSyncAt = 0;

const ACTIVE_GROUP_AUTO_SYNC_COOLDOWN_MS = 30_000;

export function useWords({ isAuthLoading = false, user = null } = {}, storage) {
  const [words, setWords] = useState(() => hydrateWords(loadWords(storage), storage));
  const [isWordsLoading, setIsWordsLoading] = useState(hasSupabaseConfig);
  const [isActiveGroupSyncing, setIsActiveGroupSyncing] = useState(() => activeGroupSyncPending);
  const [wordsError, setWordsError] = useState("");
  const [autoImportedNotice, setAutoImportedNotice] = useState(null);
  const isUsingSupabase = hasSupabaseConfig && Boolean(user);
  const wordsRef = useRef(words);
  const updateWordRef = useRef(null);
  const lastMappedWordsRef = useRef(null);
  const allowCacheSaveRef = useRef(false);
  const cacheSaveTimerRef = useRef(null);

  wordsRef.current = words;

  useEffect(() => {
    if (!hasSupabaseConfig || !user) {
      setWords(hydrateWords(loadWords(storage), storage));
      setAutoImportedNotice(null);
      setIsWordsLoading(false);
      allowCacheSaveRef.current = false;
      return undefined;
    }

    let isMounted = true;
    allowCacheSaveRef.current = false;
    const cachedWords = loadWordsForUser(user.id, storage);
    const hasCachedWords = cachedWords.length > 0;
    const groupPayloadPromise = fetchUserActiveGroupWords({
      includeWords: true,
      wordLimit: ACTIVE_GROUP_INITIAL_IMPORT_COUNT,
    });

    if (hasCachedWords) {
      setWords(hydrateWords(cachedWords, storage));
      setIsWordsLoading(false);
    } else {
      setIsWordsLoading(true);
    }

    setWordsError("");

    fetchWordsFromSupabase(user.id)
      .then((remoteWords) => {
        if (!isMounted) {
          return;
        }

        const mergedRemoteWords = mergeWordsPreservingMemory(remoteWords, wordsRef.current);
        setWords(hydrateWords(mergedRemoteWords, storage));
        setIsWordsLoading(false);
        allowCacheSaveRef.current = true;

        void groupPayloadPromise
          .then(async (groupPayload) => {
            if (!isMounted) {
              return;
            }

            const firstBatch = await importMissingActiveGroupWords(
              user.id,
              wordsRef.current,
              groupPayload,
              { limit: ACTIVE_GROUP_INITIAL_IMPORT_COUNT },
            );
            lastMappedWordsRef.current = firstBatch.mappedWords;

            if (!isMounted) {
              return;
            }

            if (firstBatch.importedWords.length > 0) {
              const nextWords = hydrateWords([...firstBatch.importedWords, ...wordsRef.current], storage);
              wordsRef.current = nextWords;
              setWords(nextWords);

              if (firstBatch.activeGroup) {
                setAutoImportedNotice({
                  count: firstBatch.importedWords.length,
                  groupCode: firstBatch.activeGroup.groupCode ?? "",
                  groupNameEn: firstBatch.activeGroup.displayNameEn ?? "",
                  groupNameZhHant: firstBatch.activeGroup.displayNameZhHant ?? "",
                });
              }
            }

          })
          .catch((error) => {
            console.warn("Could not sync active-group words in background.", error);
          });
      })
      .catch((error) => {
        if (isMounted) {
          setWordsError(error.message);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsWordsLoading(false);
          allowCacheSaveRef.current = true;
        }
      });

    return () => {
      isMounted = false;
      allowCacheSaveRef.current = false;
    };
  }, [storage, user]);

  useEffect(() => {
    if (cacheSaveTimerRef.current) {
      window.clearTimeout(cacheSaveTimerRef.current);
      cacheSaveTimerRef.current = null;
    }

    if (hasSupabaseConfig && user?.id) {
      if (!allowCacheSaveRef.current) {
        return undefined;
      }

      const scheduleSave = () => {
        saveWordsForUser(user.id, words, storage);
      };

      cacheSaveTimerRef.current = window.setTimeout(() => {
        if (typeof window.requestIdleCallback === "function") {
          window.requestIdleCallback(scheduleSave, { timeout: 3000 });
        } else {
          scheduleSave();
        }
      }, 1500);

      return () => {
        if (cacheSaveTimerRef.current) {
          window.clearTimeout(cacheSaveTimerRef.current);
          cacheSaveTimerRef.current = null;
        }
      };
    }

    if (!hasSupabaseConfig || !user) {
      saveWords(words, storage);
    }

    return undefined;
  }, [storage, user, words]);

  const addWord = useCallback(
    async (input, options = {}) => {
      const newWord = createWord(input, options);

      if (isUsingSupabase) {
        try {
          const savedWord = await insertWordInSupabase(newWord, user.id);

          setWords((currentWords) => [savedWord, ...currentWords]);
          return savedWord;
        } catch (error) {
          setWordsError(error.message);
          throw error;
        }
      }

      setWords((currentWords) => [newWord, ...currentWords]);

      return newWord;
    },
    [isUsingSupabase, user],
  );

  const updateWord = useCallback(
    async (wordId, changes) => {
      const now = getCurrentIsoDate();
      const normalizedChanges = {
        ...normalizeWordChanges(changes),
        updatedAt: now,
      };
      const currentWord = words.find((word) => word.id === wordId);

      if (!currentWord) {
        return;
      }

      const nextWord = applyWordChanges(currentWord, normalizedChanges);

      setWords((currentWords) =>
        currentWords.map((word) => (word.id === wordId ? nextWord : word)),
      );

      if (isUsingSupabase) {
        const { remoteChanges } = splitWordChanges(normalizedChanges);
        const supabaseChanges = { ...remoteChanges };

        if (Object.hasOwn(normalizedChanges, "memoryTipsByLocale")) {
          supabaseChanges.memoryTipsByLocale = normalizedChanges.memoryTipsByLocale;
        }

        if (Object.hasOwn(normalizedChanges, "memoryImage")) {
          supabaseChanges.memoryImage = normalizedChanges.memoryImage;
        }

        if (!hasRemoteWordChanges(supabaseChanges)) {
          return;
        }

        try {
          let savedWord;

          try {
            savedWord = await updateWordInSupabase(wordId, supabaseChanges);
          } catch (error) {
            if (!hasRemoteWordChanges(remoteChanges)) {
              return;
            }

            savedWord = await updateWordInSupabase(wordId, remoteChanges);
          }

          setWords((currentWords) =>
            currentWords.map((word) =>
              word.id === wordId ? mergeWordAiMemory(savedWord, nextWord) : word,
            ),
          );
        } catch (error) {
          setWordsError(error.message);
          setWords((currentWords) =>
            currentWords.map((word) =>
              word.id === wordId ? currentWord : word,
            ),
          );
        }
      }
    },
    [isUsingSupabase, words],
  );

  updateWordRef.current = updateWord;

  const deleteWord = useCallback(
    async (wordId) => {
      const currentWords = words;

      setWords((currentWords) =>
        currentWords.filter((word) => word.id !== wordId),
      );
      clearStoredWordAiMemory(wordId, storage);

      if (isUsingSupabase) {
        try {
          await deleteWordFromSupabase(wordId);
        } catch (error) {
          setWordsError(error.message);
          setWords(currentWords);
        }
      }
    },
    [isUsingSupabase, words],
  );

  const importWords = useCallback(
    async (wordInputs, options = {}) => {
      const source = options.source ?? WORD_SOURCES.IMPORT;
      const existingTerms = new Set(words.map((word) => normalizeTerm(word.term)));
      const importedWords = [];
      const skippedWords = [];

      wordInputs.forEach((wordInput) => {
        const normalizedTerm = normalizeTerm(wordInput?.term);

        if (!normalizedTerm || existingTerms.has(normalizedTerm)) {
          skippedWords.push(wordInput);
          return;
        }

        const importedWord = createWord(wordInput, { source });

        importedWords.push(importedWord);
        existingTerms.add(normalizedTerm);
      });

      if (isUsingSupabase) {
        const savedWords = [];

        try {
          for (const importedWord of importedWords) {
            const savedWord = await insertWordInSupabase(importedWord, user.id);
            savedWords.push(savedWord);
          }

          setWords((currentWords) => [...savedWords, ...currentWords]);

          return {
            importedWords: savedWords,
            skippedWords,
          };
        } catch (error) {
          if (savedWords.length > 0) {
            setWords((currentWords) => [...savedWords, ...currentWords]);
          }

          setWordsError(error.message);

          const partialError = new Error(error.message);
          partialError.savedWords = savedWords;
          partialError.skippedWords = skippedWords;
          throw partialError;
        }
      }

      setWords((currentWords) => [...importedWords, ...currentWords]);

      return {
        importedWords,
        skippedWords,
      };
    },
    [isUsingSupabase, user, words],
  );

  const syncLocalWordsToSupabase = useCallback(async () => {
    if (!isUsingSupabase) {
      throw new Error("Sign in to upload local words to Supabase.");
    }

    const localWords = loadWords(storage);

    if (localWords.length === 0) {
      return {
        importedWords: [],
        localCount: 0,
        skippedWords: [],
      };
    }

    const existingTerms = new Set(words.map((word) => normalizeTerm(word.term)));
    const importedWords = [];
    const skippedWords = [];

    for (const localWord of localWords) {
      const normalizedTerm = normalizeTerm(localWord?.term);
      const definition = normalizeText(localWord?.definition);

      if (!normalizedTerm || !definition) {
        skippedWords.push(localWord);
        continue;
      }

      if (existingTerms.has(normalizedTerm)) {
        skippedWords.push(localWord);
        continue;
      }

      try {
        const source = toSupabaseSource(localWord.source);

        const savedWord = await insertWordInSupabase(
          {
            ...localWord,
            term: normalizeText(localWord.term),
            definition,
            translation: normalizeText(localWord.translation),
            pronunciation: normalizeText(localWord.pronunciation),
            partOfSpeech: normalizeText(localWord.partOfSpeech),
            example: normalizeText(localWord.example),
            exampleTranslation: normalizeText(localWord.exampleTranslation),
            notes: normalizeText(localWord.notes),
            tags: normalizeTags(localWord.tags),
            source,
            review: {
              ...createInitialReview(),
              ...localWord.review,
            },
            mistake: {
              ...createInitialMistake(),
              ...localWord.mistake,
            },
          },
          user.id,
        );

        importedWords.push(savedWord);
        existingTerms.add(normalizedTerm);
      } catch {
        skippedWords.push(localWord);
      }
    }

    if (importedWords.length > 0) {
      setWords((currentWords) => [...importedWords, ...currentWords]);
    }

    return {
      importedWords,
      localCount: localWords.length,
      skippedWords,
    };
  }, [isUsingSupabase, storage, user, words]);

  const resetAllWords = useCallback(async () => {
    if (isUsingSupabase) {
      try {
        await deleteAllWordsFromSupabase(user.id);
      } catch (error) {
        setWordsError(error.message);
        throw error;
      }
    } else {
      resetWords(storage);
    }

    if (user?.id) {
      resetWordsForUser(user.id, storage);
    }

    clearLearningActivity(storage);
    clearMemoryTipsCache(storage);
    clearWordImageCache(storage);
    clearAllStoredWordAiMemory(storage);
    setWords([]);
    setAutoImportedNotice(null);
  }, [isUsingSupabase, storage, user]);

  const clearAutoImportedNotice = useCallback(() => {
    setAutoImportedNotice(null);
  }, []);

  const runActiveGroupMemorySync = useCallback(async () => {
    if (!isUsingSupabase || !user?.id || !updateWordRef.current) {
      return;
    }

    if (loadWordScopeMode(user.id) !== WORD_SCOPE_MODES.GROUP) {
      return;
    }

    try {
      const preloadedMappedWords = lastMappedWordsRef.current;
      lastMappedWordsRef.current = null;

      await syncActiveGroupWordMemory(
        wordsRef.current,
        (wordId, changes) => updateWordRef.current(wordId, changes),
        user.id,
        preloadedMappedWords,
        {
          batchUpdater: async (pendingUpdates) => {
            const savedWords = await batchUpdateWordMemoryInSupabase(pendingUpdates);
            if (savedWords.length > 0) {
              const savedById = new Map(savedWords.map((w) => [w.id, w]));
              setWords((currentWords) =>
                currentWords.map((word) => {
                  const saved = savedById.get(word.id);
                  return saved ? mergeWordAiMemory(saved, word) : word;
                }),
              );
            }
          },
        },
      );
    } catch (error) {
      console.warn("Could not sync active-group memory from wordbase.", error);
    }
  }, [isUsingSupabase, user?.id]);

  const runActiveGroupSync = useCallback(async (preloadedPayload = null) => {
    if (!isUsingSupabase || !user?.id) {
      return;
    }

    if (preloadedPayload) {
      queuedScopePayload = preloadedPayload;
    }

    const executeSync = async () => {
      activeGroupSyncPending = true;
      setIsActiveGroupSyncing(true);

      const applyImportedWords = (importedWords, activeGroup) => {
        if (importedWords.length === 0) {
          return;
        }

        const nextWords = hydrateWords([...importedWords, ...wordsRef.current], storage);
        wordsRef.current = nextWords;
        setWords(nextWords);

        if (activeGroup) {
          setAutoImportedNotice({
            ...buildAutoImportedNotice(activeGroup),
            count: importedWords.length,
          });
        }
      };

      try {
        const initialPayload =
          queuedScopePayload ??
          (await fetchUserActiveGroupWords({
            includeWords: true,
            wordLimit: ACTIVE_GROUP_INITIAL_IMPORT_COUNT,
            forceRefresh: true,
          }));
        queuedScopePayload = null;

        const resolvedInitialPayload =
          Array.isArray(initialPayload.mappedWords) && initialPayload.mappedWords.length > 0
            ? initialPayload
            : await fetchUserActiveGroupWords({
                includeWords: true,
                forceRefresh: true,
              });

        const firstBatch = await importMissingActiveGroupWords(
          user.id,
          wordsRef.current,
          resolvedInitialPayload,
          { limit: ACTIVE_GROUP_INITIAL_IMPORT_COUNT },
        );
        lastMappedWordsRef.current = firstBatch.mappedWords;
        applyImportedWords(firstBatch.importedWords, firstBatch.activeGroup);

        invalidateUserActiveGroupWordsCache();
        const fullBatch = await importMissingActiveGroupWords(user.id, wordsRef.current, null, {
          forceRefresh: true,
        });
        lastMappedWordsRef.current = fullBatch.mappedWords;
        applyImportedWords(fullBatch.importedWords, fullBatch.activeGroup);
      } catch (error) {
        console.warn("Could not sync active-group words from wordbase.", error);
      } finally {
        activeGroupSyncPending = false;
        setIsActiveGroupSyncing(false);

        if (queuedScopePayload) {
          void runActiveGroupSync();
        }
      }

      if (!updateWordRef.current) {
        return;
      }

      void syncActiveGroupWordMemory(
        wordsRef.current,
        (wordId, changes) => updateWordRef.current(wordId, changes),
        user.id,
        lastMappedWordsRef.current,
        {
          batchUpdater: async (pendingUpdates) => {
            const savedWords = await batchUpdateWordMemoryInSupabase(pendingUpdates);
            if (savedWords.length > 0) {
              const savedById = new Map(savedWords.map((w) => [w.id, w]));
              setWords((currentWords) =>
                currentWords.map((word) => {
                  const saved = savedById.get(word.id);
                  return saved ? mergeWordAiMemory(saved, word) : word;
                }),
              );
            }
          },
        },
      ).catch((error) => {
        console.warn("Could not sync active-group word memory in background.", error);
      });
    };

    activeGroupSyncChain = activeGroupSyncChain
      ? activeGroupSyncChain.then(executeSync, executeSync)
      : executeSync();

    try {
      await activeGroupSyncChain;
    } finally {
      if (activeGroupSyncChain) {
        activeGroupSyncChain = null;
      }
    }
  }, [isUsingSupabase, storage, user?.id]);

  const ensureActiveGroupWordsSynced = useCallback(async () => {
    if (!isUsingSupabase || !user?.id) {
      return;
    }

    if (loadWordScopeMode(user.id) !== WORD_SCOPE_MODES.GROUP) {
      return;
    }

    await runActiveGroupSync();
  }, [isUsingSupabase, runActiveGroupSync, user?.id]);

  useEffect(() => {
    if (!isUsingSupabase || isWordsLoading || !user?.id) {
      return undefined;
    }

    void runActiveGroupMemorySync();
  }, [isUsingSupabase, isWordsLoading, runActiveGroupMemorySync, user?.id]);

  useEffect(() => {
    if (!isUsingSupabase || typeof window === "undefined") {
      return undefined;
    }

    const handleGroupSync = () => {
      if (loadWordScopeMode(user?.id) !== WORD_SCOPE_MODES.GROUP) {
        return;
      }

      void runActiveGroupSync();
    };

    const handleActiveGroupChanged = (event) => {
      lastActiveGroupAutoSyncAt = 0;
      void runActiveGroupSync(event?.detail?.scopePayload ?? null);
    };

    window.addEventListener(ACTIVE_GROUP_CHANGED_EVENT, handleActiveGroupChanged);
    window.addEventListener(WORD_SCOPE_MODE_CHANGED_EVENT, handleGroupSync);

    return () => {
      window.removeEventListener(ACTIVE_GROUP_CHANGED_EVENT, handleActiveGroupChanged);
      window.removeEventListener(WORD_SCOPE_MODE_CHANGED_EVENT, handleGroupSync);
    };
  }, [isUsingSupabase, runActiveGroupSync, user?.id]);

  useEffect(() => {
    if (!isUsingSupabase || isWordsLoading || !user?.id) {
      return;
    }

    if (loadWordScopeMode(user.id) !== WORD_SCOPE_MODES.GROUP) {
      return;
    }

    const cachedScope = loadCachedActiveGroupScope(user.id);
    if (!cachedScope?.activeGroup || !Array.isArray(cachedScope.mappedTerms)) {
      return;
    }

    const mappedSet = new Set(
      cachedScope.mappedTerms.map((term) => normalizeTerm(term)).filter(Boolean),
    );
    if (mappedSet.size === 0) {
      return;
    }

    const hasScopedWords = wordsRef.current.some((word) =>
      mappedSet.has(normalizeTerm(word.term)),
    );
    if (hasScopedWords || activeGroupSyncPending) {
      return;
    }

    const now = Date.now();
    if (now - lastActiveGroupAutoSyncAt < ACTIVE_GROUP_AUTO_SYNC_COOLDOWN_MS) {
      return;
    }

    lastActiveGroupAutoSyncAt = now;
    void runActiveGroupSync();
  }, [isUsingSupabase, isWordsLoading, runActiveGroupSync, user?.id]);

  return {
    addWord,
    updateWord,
    deleteWord,
    importWords,
    isUsingSupabase,
    isWordsLoading: isAuthLoading || isWordsLoading,
    isActiveGroupSyncing,
    autoImportedNotice,
    clearAutoImportedNotice,
    ensureActiveGroupWordsSynced,
    resetAllWords,
    syncActiveGroupWords: runActiveGroupSync,
    syncLocalWordsToSupabase,
    words,
    wordsError,
  };
}
