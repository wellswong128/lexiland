import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ensureReviewGamePlan,
  hasActiveReviewSession,
  loadReviewSession,
} from "../../lib/reviewSessionStorage.js";
import { ensureReviewSessionWords } from "./ensureReviewSessionWords.js";
import {
  buildGameWordBank,
  getSequentialRoundEntries,
  shouldUseGamePlan,
} from "./gameWordBank.js";

export function useReviewSessionPlay(words, options) {
  useEffect(() => {
    ensureReviewSessionWords(words);
  }, [words]);

  const defaultBank = useMemo(() => {
    ensureReviewSessionWords(words);
    return buildGameWordBank(words, options);
  }, [options, words]);
  const playBankRef = useRef(null);
  const pickerIndexRef = useRef(0);
  const session = loadReviewSession();
  const reviewSessionKey = `${session?.startedAt ?? "none"}:${session?.wordIds.length ?? 0}:${words.length}`;

  useEffect(() => {
    playBankRef.current = null;
    pickerIndexRef.current = 0;
  }, [reviewSessionKey]);

  const beginPlaySession = useCallback(() => {
    ensureReviewSessionWords(words);

    if (!hasActiveReviewSession()) {
      playBankRef.current = null;
      pickerIndexRef.current = 0;
      return buildGameWordBank(words, options);
    }

    ensureReviewGamePlan();
    playBankRef.current = buildGameWordBank(words, options);
    pickerIndexRef.current = 0;
    return playBankRef.current;
  }, [options, words]);

  const pickNextEntry = useCallback((bank) => {
    if (!shouldUseGamePlan(bank)) {
      return null;
    }

    const questionPool = bank.questionEntries ?? bank.entries;
    const entry = questionPool[pickerIndexRef.current % questionPool.length];

    pickerIndexRef.current += 1;
    return entry;
  }, []);

  const pickRoundEntries = useCallback((bank, totalRounds) => {
    if (!shouldUseGamePlan(bank)) {
      return null;
    }

    return getSequentialRoundEntries(bank.questionEntries ?? bank.entries, totalRounds);
  }, []);

  return {
    beginPlaySession,
    defaultBank,
    getActivePlayBank: () => playBankRef.current ?? defaultBank,
    pickNextEntry,
    pickRoundEntries,
  };
}
