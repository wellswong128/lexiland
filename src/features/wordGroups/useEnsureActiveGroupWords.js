import { useEffect, useRef } from "react";
import { useWordsContext } from "../words/WordsContext.jsx";
import { useActiveGroupWordScope } from "./useActiveGroupWordScope.js";

const ACTIVE_GROUP_ENSURE_SYNC_COOLDOWN_MS = 30_000;

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

  useEffect(() => {
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
    isGroupScopeActive,
    isLoadingScope,
    isWordsLoading,
    mappedTermCount,
    scopeReason,
    scopedWords.length,
    syncActiveGroupWords,
  ]);
}
