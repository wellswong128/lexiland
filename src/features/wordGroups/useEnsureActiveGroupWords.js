import { useEffect, useRef } from "react";
import { useWordsContext } from "../words/WordsContext.jsx";
import { useActiveGroupWordScope } from "./useActiveGroupWordScope.js";

const ACTIVE_GROUP_ENSURE_SYNC_COOLDOWN_MS = 30_000;
const ACTIVE_GROUP_MAX_AUTO_SYNC_ATTEMPTS = 2;

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
  const autoSyncAttemptsRef = useRef(0);

  useEffect(() => {
    if (mappedTermCount !== lastMappedTermCountRef.current) {
      lastMappedTermCountRef.current = mappedTermCount;
      lastEnsureSyncAtRef.current = 0;
      autoSyncAttemptsRef.current = 0;
    }

    if (scopedWords.length > 0) {
      autoSyncAttemptsRef.current = 0;
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

    if (autoSyncAttemptsRef.current >= ACTIVE_GROUP_MAX_AUTO_SYNC_ATTEMPTS) {
      return;
    }

    const now = Date.now();
    if (now - lastEnsureSyncAtRef.current < ACTIVE_GROUP_ENSURE_SYNC_COOLDOWN_MS) {
      return;
    }

    lastEnsureSyncAtRef.current = now;
    autoSyncAttemptsRef.current += 1;
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
