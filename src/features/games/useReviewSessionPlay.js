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

    if (!playBankRef.current) {
      ensureReviewGamePlan();
      playBankRef.current = buildGameWordBank(words, options);
    }

    pickerIndexRef.current = 0;
    return playBankRef.current;
  }, [defaultBank, options, words]);

  const pickNextEntry = useCallback((bank, { level } = {}) => {
    if (!bank.usingReviewSession) {
      return null;
    }

    const pool =
      typeof level === "number"
        ? bank.entries.filter((entry) => {
            if (level <= 2) {
              return entry.word.length <= 6;
            }

            if (level <= 5) {
              return entry.word.length <= 9;
            }

            return true;
          })
        : bank.entries;
    const activePool = pool.length > 0 ? pool : bank.entries;
    const entry = activePool[pickerIndexRef.current % activePool.length];

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
