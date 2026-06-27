import { useEffect } from "react";
import { useWordsContext } from "../words/WordsContext.jsx";
import { useActiveGroupWordScope } from "./useActiveGroupWordScope.js";

export function useEnsureActiveGroupWords() {
  const { isActiveGroupSyncing, isWordsLoading, syncActiveGroupWords, user, words } =
    useWordsContext();
  const { isGroupScopeActive, isLoadingScope, scopeReason, scopedWords } = useActiveGroupWordScope(
    words,
    user,
  );

  useEffect(() => {
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

    void syncActiveGroupWords();
  }, [
    isActiveGroupSyncing,
    isGroupScopeActive,
    isLoadingScope,
    isWordsLoading,
    scopeReason,
    scopedWords.length,
    syncActiveGroupWords,
  ]);
}
