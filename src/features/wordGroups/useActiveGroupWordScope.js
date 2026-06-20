import { useCallback, useEffect, useMemo, useState } from "react";
import { hasSupabaseConfig } from "../../lib/supabaseClient.js";
import { normalizeTerm } from "../words/wordTypes.js";
import { getApiAuthHeaders } from "../../lib/apiAuth.js";
import { ACTIVE_GROUP_CHANGED_EVENT } from "./wordGroupScopeEvents.js";
import {
  loadWordScopeMode,
  saveWordScopeMode,
  WORD_SCOPE_MODE_CHANGED_EVENT,
  WORD_SCOPE_MODES,
} from "./wordScopeMode.js";

async function fetchActiveGroupWords() {
  const authHeaders = await getApiAuthHeaders();
  const response = await fetch("/api/user-active-group-words", {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Failed to load active-group words.");
  }

  return payload;
}

export function useActiveGroupWordScope(words, user) {
  const [state, setState] = useState({
    activeGroup: null,
    mappedTerms: [],
    isLoading: false,
    error: "",
  });
  const [scopeMode, setScopeMode] = useState(() => loadWordScopeMode(user?.id));

  const shouldScopeByGroup = hasSupabaseConfig && Boolean(user);
  const isUsingCustomWords =
    shouldScopeByGroup && Boolean(state.activeGroup) && scopeMode === WORD_SCOPE_MODES.CUSTOM;
  const isGroupScopeActive =
    shouldScopeByGroup && Boolean(state.activeGroup) && scopeMode === WORD_SCOPE_MODES.GROUP;

  useEffect(() => {
    setScopeMode(loadWordScopeMode(user?.id));
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleScopeModeChanged = () => {
      setScopeMode(loadWordScopeMode(user?.id));
    };

    window.addEventListener(WORD_SCOPE_MODE_CHANGED_EVENT, handleScopeModeChanged);
    return () => {
      window.removeEventListener(WORD_SCOPE_MODE_CHANGED_EVENT, handleScopeModeChanged);
    };
  }, [user?.id]);

  const loadScope = useCallback(async () => {
    if (!shouldScopeByGroup) {
      setState({
        activeGroup: null,
        mappedTerms: [],
        isLoading: false,
        error: "",
      });
      return;
    }

    setState((current) => ({
      ...current,
      isLoading: true,
      error: "",
    }));

    try {
      const payload = await fetchActiveGroupWords();
      setState({
        activeGroup: payload.activeGroup ?? null,
        mappedTerms: Array.isArray(payload.mappedTerms) ? payload.mappedTerms : [],
        isLoading: false,
        error: "",
      });
    } catch (error) {
      setState({
        activeGroup: null,
        mappedTerms: [],
        isLoading: false,
        error: error.message || "Failed to load active-group words.",
      });
    }
  }, [shouldScopeByGroup]);

  useEffect(() => {
    void loadScope();
  }, [loadScope]);

  useEffect(() => {
    if (!shouldScopeByGroup || typeof window === "undefined") {
      return undefined;
    }

    const handleActiveGroupChanged = () => {
      saveWordScopeMode(user?.id, WORD_SCOPE_MODES.GROUP);
      setScopeMode(WORD_SCOPE_MODES.GROUP);
      void loadScope();
    };

    window.addEventListener(ACTIVE_GROUP_CHANGED_EVENT, handleActiveGroupChanged);
    return () => {
      window.removeEventListener(ACTIVE_GROUP_CHANGED_EVENT, handleActiveGroupChanged);
    };
  }, [loadScope, shouldScopeByGroup, user?.id]);

  const switchToCustomWords = useCallback(() => {
    saveWordScopeMode(user?.id, WORD_SCOPE_MODES.CUSTOM);
    setScopeMode(WORD_SCOPE_MODES.CUSTOM);
  }, [user?.id]);

  const switchToGroupWords = useCallback(() => {
    saveWordScopeMode(user?.id, WORD_SCOPE_MODES.GROUP);
    setScopeMode(WORD_SCOPE_MODES.GROUP);
  }, [user?.id]);

  const mappedSet = useMemo(
    () => new Set(state.mappedTerms.map((value) => normalizeTerm(value)).filter(Boolean)),
    [state.mappedTerms],
  );

  const scopedWords = useMemo(() => {
    if (!isGroupScopeActive) {
      return words;
    }
    if (mappedSet.size === 0) {
      return [];
    }

    return words.filter((word) => mappedSet.has(normalizeTerm(word.term)));
  }, [isGroupScopeActive, mappedSet, words]);

  const scopeReason = !shouldScopeByGroup
    ? "not-scoped"
    : isUsingCustomWords
      ? "custom-words"
      : !state.activeGroup
        ? "no-active-group"
        : mappedSet.size === 0
          ? "active-group-empty"
          : scopedWords.length === 0
            ? "no-matches"
            : "ok";

  return {
    activeGroup: state.activeGroup,
    isGroupScopeActive,
    isScoped: shouldScopeByGroup,
    isUsingCustomWords,
    isLoadingScope: state.isLoading,
    scopeError: state.error,
    scopeMode,
    scopeReason,
    scopedWords,
    switchToCustomWords,
    switchToGroupWords,
  };
}
