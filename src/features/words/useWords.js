import { useCallback, useEffect, useState } from "react";
import { hasSupabaseConfig } from "../../lib/supabaseClient.js";
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
} from "./wordTypes.js";
import {
  deleteAllWordsFromSupabase,
  deleteWordFromSupabase,
  fetchWordsFromSupabase,
  insertWordInSupabase,
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

  if (Object.hasOwn(normalizedChanges, "notes")) {
    normalizedChanges.notes = normalizeText(normalizedChanges.notes);
  }

  if (Object.hasOwn(normalizedChanges, "tags")) {
    normalizedChanges.tags = normalizeTags(normalizedChanges.tags);
  }

  return normalizedChanges;
}

function applyWordChanges(word, changes) {
  return {
    ...word,
    ...changes,
    id: word.id,
    createdAt: word.createdAt,
    review: changes.review ? { ...word.review, ...changes.review } : word.review,
    mistake: changes.mistake
      ? { ...word.mistake, ...changes.mistake }
      : word.mistake,
  };
}

export function useWords({ isAuthLoading = false, user = null } = {}, storage) {
  const [words, setWords] = useState(() => loadWords(storage));
  const [isWordsLoading, setIsWordsLoading] = useState(hasSupabaseConfig);
  const [wordsError, setWordsError] = useState("");
  const isUsingSupabase = hasSupabaseConfig && Boolean(user);

  useEffect(() => {
    if (!hasSupabaseConfig || !user) {
      setWords(loadWords(storage));
      setIsWordsLoading(false);
      return undefined;
    }

    let isMounted = true;

    setIsWordsLoading(true);
    setWordsError("");

    fetchWordsFromSupabase(user.id)
      .then((remoteWords) => {
        if (isMounted) {
          setWords(remoteWords);
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
        try {
          const savedWord = await updateWordInSupabase(wordId, normalizedChanges);

          setWords((currentWords) =>
            currentWords.map((word) => (word.id === wordId ? savedWord : word)),
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
        try {
          const savedWords = [];

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
          setWordsError(error.message);
          throw error;
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
        const source = Object.values(WORD_SOURCES).includes(localWord.source)
          && localWord.source !== WORD_SOURCES.PHOTO
          ? localWord.source
          : WORD_SOURCES.IMPORT;

        const savedWord = await insertWordInSupabase(
          {
            ...localWord,
            term: normalizeText(localWord.term),
            definition,
            translation: normalizeText(localWord.translation),
            pronunciation: normalizeText(localWord.pronunciation),
            partOfSpeech: normalizeText(localWord.partOfSpeech),
            example: normalizeText(localWord.example),
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
