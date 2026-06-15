import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ensureReviewGamePlan,
  loadReviewSession,
} from "../../lib/reviewSessionStorage.js";
import { buildGameWordBank, getSequentialRoundEntries } from "./gameWordBank.js";

export function useReviewSessionPlay(words, options) {
  const defaultBank = useMemo(() => buildGameWordBank(words, options), [options, words]);
  const playBankRef = useRef(null);
  const pickerIndexRef = useRef(0);
  const reviewSessionStartedAt = loadReviewSession()?.startedAt ?? null;

  useEffect(() => {
    playBankRef.current = null;
    pickerIndexRef.current = 0;
  }, [reviewSessionStartedAt]);

  const beginPlaySession = useCallback(() => {
    const hasReviewSession = Boolean(loadReviewSession()?.wordIds.length);

    if (!hasReviewSession) {
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
    if (!bank.usingReviewSession || bank.entries.length === 0) {
      return null;
    }

    const entry = bank.entries[pickerIndexRef.current % bank.entries.length];

    pickerIndexRef.current += 1;
    return entry;
  }, []);

  const pickRoundEntries = useCallback((bank, totalRounds) => {
    if (!bank.usingReviewSession) {
      return null;
    }

    return getSequentialRoundEntries(bank.entries, totalRounds);
  }, []);

  return {
    beginPlaySession,
    defaultBank,
    getActivePlayBank: () => playBankRef.current ?? defaultBank,
    pickNextEntry,
    pickRoundEntries,
  };
}
