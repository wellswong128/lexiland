import { useMemo } from "react";
import { hasSupabaseConfig } from "../../lib/supabaseClient.js";
import { normalizeTerm } from "../words/wordTypes.js";
import { useActiveGroupScopeContext } from "./ActiveGroupScopeContext.jsx";

export function useActiveGroupWordScope(words, user) {
  const shouldScopeByGroup = hasSupabaseConfig && Boolean(user);
  const scope = useActiveGroupScopeContext();

  const mappedSet = useMemo(() => {
    if (!shouldScopeByGroup) {
      return new Set();
    }

    return new Set(scope.mappedTerms.map((value) => normalizeTerm(value)).filter(Boolean));
  }, [shouldScopeByGroup, scope.mappedTerms]);

  const isGroupScopeActive = shouldScopeByGroup && scope.isGroupScopeActive;
  const isUsingCustomWords = shouldScopeByGroup && scope.isUsingCustomWords;

  const scopedWords = useMemo(() => {
    if (!shouldScopeByGroup || !isGroupScopeActive) {
      return words;
    }

    if (mappedSet.size === 0) {
      return [];
    }

    return words.filter((word) => mappedSet.has(normalizeTerm(word.term)));
  }, [isGroupScopeActive, mappedSet, shouldScopeByGroup, words]);

  const mappedTermCount = mappedSet.size;
  const missingMappedTermCount = isGroupScopeActive
    ? Math.max(0, mappedTermCount - scopedWords.length)
    : 0;

  const scopeReason = !shouldScopeByGroup
    ? "not-scoped"
    : isUsingCustomWords
      ? "custom-words"
      : !scope.activeGroup
        ? "no-active-group"
        : mappedSet.size === 0
          ? "active-group-empty"
          : scopedWords.length === 0
            ? "no-matches"
            : "ok";

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
      scopeRevision: 0,
      switchToCustomWords: scope.switchToCustomWords,
      switchToGroupWords: scope.switchToGroupWords,
    };
  }

  return {
    activeGroup: scope.activeGroup,
    isGroupScopeActive,
    isScoped: scope.isScoped,
    isUsingCustomWords,
    isLoadingScope: scope.isLoading,
    scopeError: scope.error,
    scopeMode: scope.scopeMode,
    scopeReason,
    mappedTermCount,
    missingMappedTermCount,
    scopedWords,
    scopeRevision: scope.scopeRevision,
    switchToCustomWords: scope.switchToCustomWords,
    switchToGroupWords: scope.switchToGroupWords,
  };
}
