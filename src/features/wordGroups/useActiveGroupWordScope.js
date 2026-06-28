import { useMemo } from "react";
import { hasSupabaseConfig } from "../../lib/supabaseClient.js";
import { normalizeTerm } from "../words/wordTypes.js";
import { useActiveGroupScopeContext } from "./ActiveGroupScopeContext.jsx";

export function useActiveGroupWordScope(words, user) {
  const shouldScopeByGroup = hasSupabaseConfig && Boolean(user);
  const scope = useActiveGroupScopeContext();

  if (!shouldScopeByGroup) {
    return {
      activeGroup: null,
      isGroupScopeActive: false,
      isScoped: false,
      isUsingCustomWords: false,
      isLoadingScope: false,
      scopeError: "",
      scopeMode: scope.scopeMode,
      scopeReason: "not-scoped",
      mappedTermCount: 0,
      missingMappedTermCount: 0,
      scopedWords: words,
      switchToCustomWords: scope.switchToCustomWords,
      switchToGroupWords: scope.switchToGroupWords,
    };
  }

  const mappedSet = useMemo(
    () => new Set(scope.mappedTerms.map((value) => normalizeTerm(value)).filter(Boolean)),
    [scope.mappedTerms],
  );

  const scopedWords = useMemo(() => {
    if (!scope.isGroupScopeActive) {
      return words;
    }
    if (mappedSet.size === 0) {
      return [];
    }

    return words.filter((word) => mappedSet.has(normalizeTerm(word.term)));
  }, [mappedSet, scope.isGroupScopeActive, words]);

  const mappedTermCount = mappedSet.size;
  const missingMappedTermCount = scope.isGroupScopeActive
    ? Math.max(0, mappedTermCount - scopedWords.length)
    : 0;

  const scopeReason = scope.isUsingCustomWords
    ? "custom-words"
    : !scope.activeGroup
      ? "no-active-group"
      : mappedSet.size === 0
        ? "active-group-empty"
        : scopedWords.length === 0
          ? "no-matches"
          : "ok";

  return {
    activeGroup: scope.activeGroup,
    isGroupScopeActive: scope.isGroupScopeActive,
    isScoped: scope.isScoped,
    isUsingCustomWords: scope.isUsingCustomWords,
    isLoadingScope: scope.isLoading,
    scopeError: scope.error,
    scopeMode: scope.scopeMode,
    scopeReason,
    mappedTermCount,
    missingMappedTermCount,
    scopedWords,
    switchToCustomWords: scope.switchToCustomWords,
    switchToGroupWords: scope.switchToGroupWords,
  };
}
