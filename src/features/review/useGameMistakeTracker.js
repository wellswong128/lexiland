import { useCallback, useRef, useState } from "react";
import { normalizeTerm } from "../words/wordTypes.js";
import { useWordsContext } from "../words/WordsContext.jsx";
import { commitGameMistakes } from "./gameMistakeHelpers.js";

export function useGameMistakeTracker() {
  const wrongCountsRef = useRef({});
  const { updateWord, words } = useWordsContext();
  const [lastCommittedTerms, setLastCommittedTerms] = useState([]);

  const recordWrong = useCallback((term) => {
    const normalizedTerm = normalizeTerm(term);

    if (!normalizedTerm) {
      return;
    }

    wrongCountsRef.current[normalizedTerm] =
      (wrongCountsRef.current[normalizedTerm] || 0) + 1;
  }, []);

  const resetTracker = useCallback(() => {
    wrongCountsRef.current = {};
    setLastCommittedTerms([]);
  }, []);

  const commitMistakes = useCallback(() => {
    const addedTerms = commitGameMistakes({
      wrongCounts: wrongCountsRef.current,
      words,
      updateWord,
    });

    wrongCountsRef.current = {};
    setLastCommittedTerms(addedTerms);

    return addedTerms;
  }, [updateWord, words]);

  return {
    commitMistakes,
    lastCommittedTerms,
    recordWrong,
    resetTracker,
  };
}
