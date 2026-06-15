import { useCallback, useEffect, useState } from "react";
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

export function useWords({ isAuthLoading = false, user = null } = {}, storage) {
  const [words, setWords] = useState(() => hydrateWords(loadWords(storage), storage));
  const [isWordsLoading, setIsWordsLoading] = useState(hasSupabaseConfig);
  const [wordsError, setWordsError] = useState("");
  const isUsingSupabase = hasSupabaseConfig && Boolean(user);

  useEffect(() => {
    if (!hasSupabaseConfig || !user) {
      setWords(hydrateWords(loadWords(storage), storage));
      setIsWordsLoading(false);
      return undefined;
    }

    let isMounted = true;

    setIsWordsLoading(true);
    setWordsError("");

    fetchWordsFromSupabase(user.id)
      .then((remoteWords) => {
        if (isMounted) {
          setWords(hydrateWords(remoteWords, storage));
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
  }, [isUsingSupabase, storage, user]);

  return {
    addWord,
    updateWord,
    deleteWord,
    importWords,
    isUsingSupabase,
    isWordsLoading: isAuthLoading || isWordsLoading,
    resetAllWords,
    syncLocalWordsToSupabase,
    words,
    wordsError,
  };
}
