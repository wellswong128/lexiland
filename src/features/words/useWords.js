import { useCallback, useEffect, useRef, useState } from "react";
import { hasSupabaseConfig } from "../../lib/supabaseClient.js";
import { clearLearningActivity } from "../../lib/learningActivity.js";
import {
  clearAllStoredWordAiMemory,
  clearStoredWordAiMemory,
  hydrateWordAiMemory,
} from "../../lib/wordAiMemoryStorage.js";
import { clearMemoryTipsCache } from "./memoryTipsApi.js";
import { clearWordImageCache } from "./wordImageApi.js";
import { loadWords, resetWords, saveWords } from "../../lib/storage.js";
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
  mapWordChangesToUpdate,
  updateWordInSupabase,
} from "./wordsApi.js";
import { fetchUserActiveGroupWords } from "../wordGroups/wordGroupsApi.js";
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
  return words.map((word) => hydrateWordAiMemory(word, storage));
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

async function importMissingActiveGroupWords(userId, existingWords) {
  const payload = await fetchUserActiveGroupWords({ includeWords: true });
  const mappedWords = Array.isArray(payload.mappedWords) ? payload.mappedWords : [];
  if (!payload.activeGroup || mappedWords.length === 0) {
    return { activeGroup: payload.activeGroup ?? null, importedWords: [] };
  }

  const existingTerms = new Set(existingWords.map((word) => normalizeTerm(word.term)));
  const savedWords = [];

  for (const sourceWord of mappedWords) {
    const term = normalizeText(sourceWord?.term);
    const definition = normalizeText(sourceWord?.definition);
    const termKey = normalizeTerm(term);
    if (!termKey || !definition || existingTerms.has(termKey)) {
      continue;
    }

    try {
      const draft = createWord(
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
      );
      const saved = await insertWordInSupabase(draft, userId);
      savedWords.push(saved);
      existingTerms.add(termKey);
    } catch {
      // Skip invalid or duplicate terms and continue importing remaining words.
    }
  }

  return {
    activeGroup: payload.activeGroup ?? null,
    importedWords: savedWords,
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

export function useWords({ isAuthLoading = false, user = null } = {}, storage) {
  const [words, setWords] = useState(() => hydrateWords(loadWords(storage), storage));
  const [isWordsLoading, setIsWordsLoading] = useState(hasSupabaseConfig);
  const [wordsError, setWordsError] = useState("");
  const [autoImportedNotice, setAutoImportedNotice] = useState(null);
  const isUsingSupabase = hasSupabaseConfig && Boolean(user);
  const wordsRef = useRef(words);
  const updateWordRef = useRef(null);

  wordsRef.current = words;

  useEffect(() => {
    if (!hasSupabaseConfig || !user) {
      setWords(hydrateWords(loadWords(storage), storage));
      setAutoImportedNotice(null);
      setIsWordsLoading(false);
      return undefined;
    }

    let isMounted = true;

    setIsWordsLoading(true);
    setWordsError("");

    fetchWordsFromSupabase(user.id)
      .then(async (remoteWords) => {
        if (!isMounted) {
          return;
        }
        const { importedWords, activeGroup } = await importMissingActiveGroupWords(
          user.id,
          remoteWords,
        );
        if (!isMounted) {
          return;
        }
        const nextWords = importedWords.length > 0 ? [...importedWords, ...remoteWords] : remoteWords;
        setWords(hydrateWords(nextWords, storage));
        if (importedWords.length > 0 && activeGroup) {
          setAutoImportedNotice({
            count: importedWords.length,
            groupCode: activeGroup.groupCode ?? "",
            groupNameEn: activeGroup.displayNameEn ?? "",
            groupNameZhHant: activeGroup.displayNameZhHant ?? "",
          });
        }
      })
      .catch((error) => {
        if (isMounted) {
          setWordsError(error.message);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsWordsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [storage, user]);

  useEffect(() => {
    if (!hasSupabaseConfig || !user) {
      saveWords(words, storage);
    }
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
      await syncActiveGroupWordMemory(
        wordsRef.current,
        (wordId, changes) => updateWordRef.current(wordId, changes),
        user.id,
      );
    } catch (error) {
      console.warn("Could not sync active-group memory from wordbase.", error);
    }
  }, [isUsingSupabase, user?.id]);

  const runActiveGroupSync = useCallback(async () => {
    if (!isUsingSupabase || !user?.id || !updateWordRef.current) {
      return;
    }

    try {
      const { importedWords, activeGroup } = await importMissingActiveGroupWords(
        user.id,
        wordsRef.current,
      );

      if (importedWords.length > 0) {
        const nextWords = hydrateWords([...importedWords, ...wordsRef.current], storage);
        wordsRef.current = nextWords;
        setWords(nextWords);
        if (activeGroup) {
          setAutoImportedNotice({
            ...buildAutoImportedNotice(activeGroup),
            count: importedWords.length,
          });
        }
      }

      await syncActiveGroupWordMemory(
        wordsRef.current,
        (wordId, changes) => updateWordRef.current(wordId, changes),
        user.id,
      );
    } catch (error) {
      console.warn("Could not sync active-group words from wordbase.", error);
    }
  }, [isUsingSupabase, storage, user?.id]);

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

    const handleActiveGroupChanged = () => {
      void runActiveGroupSync();
    };

    window.addEventListener(ACTIVE_GROUP_CHANGED_EVENT, handleActiveGroupChanged);
    window.addEventListener(WORD_SCOPE_MODE_CHANGED_EVENT, handleGroupSync);

    return () => {
      window.removeEventListener(ACTIVE_GROUP_CHANGED_EVENT, handleActiveGroupChanged);
      window.removeEventListener(WORD_SCOPE_MODE_CHANGED_EVENT, handleGroupSync);
    };
  }, [isUsingSupabase, runActiveGroupSync, user?.id]);

  return {
    addWord,
    updateWord,
    deleteWord,
    importWords,
    isUsingSupabase,
    isWordsLoading: isAuthLoading || isWordsLoading,
    autoImportedNotice,
    clearAutoImportedNotice,
    resetAllWords,
    syncLocalWordsToSupabase,
    words,
    wordsError,
  };
}
