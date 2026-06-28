import { useEffect, useRef } from "react";
import { useWordsContext } from "../words/WordsContext.jsx";
import { useActiveGroupWordScope } from "./useActiveGroupWordScope.js";

const ACTIVE_GROUP_ENSURE_SYNC_COOLDOWN_MS = 10_000;

export function useEnsureActiveGroupWords() {
  const { isActiveGroupSyncing, isWordsLoading, syncActiveGroupWords, user, words } =
    useWordsContext();
  const {
    isGroupScopeActive,
    isLoadingScope,
    mappedTermCount,
    scopeReason,
    scopedWords,
  } = useActiveGroupWordScope(words, user);
  const lastEnsureSyncAtRef = useRef(0);
  const lastMappedTermCountRef = useRef(0);
  const wasSyncingRef = useRef(false);

  useEffect(() => {
    if (wasSyncingRef.current && !isActiveGroupSyncing && scopedWords.length === 0) {
      lastEnsureSyncAtRef.current = 0;
    }
    wasSyncingRef.current = isActiveGroupSyncing;

    if (mappedTermCount !== lastMappedTermCountRef.current) {
      lastMappedTermCountRef.current = mappedTermCount;
      lastEnsureSyncAtRef.current = 0;
    }

    if (
      isWordsLoading ||
      isLoadingScope ||
      isActiveGroupSyncing ||
      !isGroupScopeActive ||
      scopeReason !== "no-matches" ||
      scopedWords.length > 0
    ) {
      return;
    }

    const now = Date.now();
    if (now - lastEnsureSyncAtRef.current < ACTIVE_GROUP_ENSURE_SYNC_COOLDOWN_MS) {
      return;
    }

    lastEnsureSyncAtRef.current = now;
    void syncActiveGroupWords();
  }, [
    isActiveGroupSyncing,
    isGroupScopeActive,
    isLoadingScope,
    isWordsLoading,
    mappedTermCount,
    scopeReason,
    scopedWords.length,
    syncActiveGroupWords,
  ]);
}
