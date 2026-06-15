import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ensureReviewGamePlan,
  loadReviewSession,
} from "../../lib/reviewSessionStorage.js";
import { buildGameWordBank } from "./gameWordBank.js";

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
    if (!defaultBank.usingReviewSession) {
      playBankRef.current = null;
      pickerIndexRef.current = 0;
      return defaultBank;
    }

    ensureReviewGamePlan();
    playBankRef.current = buildGameWordBank(words, options);
    pickerIndexRef.current = 0;
    return playBankRef.current;
  }, [defaultBank, options, words]);

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

    const rounds = [];

    for (let index = 0; index < totalRounds; index += 1) {
      rounds.push(bank.entries[index % bank.entries.length]);
    }

    return rounds;
  }, []);

  return {
    beginPlaySession,
    defaultBank,
    getActivePlayBank: () => playBankRef.current ?? defaultBank,
    pickNextEntry,
    pickRoundEntries,
  };
}
