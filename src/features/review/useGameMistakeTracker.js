import { useCallback, useRef, useState } from "react";
import { REVIEW_RESULTS, normalizeTerm } from "../words/wordTypes.js";
import { useWordsContext } from "../words/WordsContext.jsx";
import {
  maybeRecordDailyMistakeClear,
  recordDailyGameCompleted,
} from "../../lib/learningActivity.js";
import {
  commitGameMistakes,
  findWordInLibrary,
} from "./gameMistakeHelpers.js";
import { updateReviewResult } from "./reviewHelpers.js";

export function useGameMistakeTracker() {
  const wrongCountsRef = useRef({});
  const { updateWord, words } = useWordsContext();
  const [lastCommittedTerms, setLastCommittedTerms] = useState([]);

  const persistReviewResult = useCallback(
    (term, result) => {
      const word = findWordInLibrary(words, term);

      if (!word) {
        return;
      }

      maybeRecordDailyMistakeClear(word, result);
      updateWord(word.id, updateReviewResult(word, result));
    },
    [updateWord, words],
  );

  const recordCorrect = useCallback(
    (term) => {
      persistReviewResult(term, REVIEW_RESULTS.CORRECT);
    },
    [persistReviewResult],
  );

  const recordWrong = useCallback(
    (term) => {
      const normalizedTerm = normalizeTerm(term);

      if (!normalizedTerm) {
        return;
      }

      wrongCountsRef.current[normalizedTerm] =
        (wrongCountsRef.current[normalizedTerm] || 0) + 1;
      persistReviewResult(term, REVIEW_RESULTS.INCORRECT);
    },
    [persistReviewResult],
  );

  const resetTracker = useCallback(() => {
    wrongCountsRef.current = {};
    setLastCommittedTerms([]);
  }, []);

  const commitMistakes = useCallback(() => {
    const addedTerms = commitGameMistakes({
      wrongCounts: wrongCountsRef.current,
      words,
    });

    wrongCountsRef.current = {};
    setLastCommittedTerms(addedTerms);
    recordDailyGameCompleted();

    return addedTerms;
  }, [words]);

  return {
    commitMistakes,
    lastCommittedTerms,
    recordCorrect,
    recordWrong,
    resetTracker,
  };
}
