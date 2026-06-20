import { useEffect, useMemo, useState } from "react";
import { hasSupabaseConfig } from "../../lib/supabaseClient.js";
import { normalizeTerm } from "../words/wordTypes.js";
import { getApiAuthHeaders } from "../../lib/apiAuth.js";

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

  const shouldScopeByGroup = hasSupabaseConfig && Boolean(user);

  useEffect(() => {
    if (!shouldScopeByGroup) {
      setState({
        activeGroup: null,
        mappedTerms: [],
        isLoading: false,
        error: "",
      });
      return;
    }

    let cancelled = false;

    setState((current) => ({
      ...current,
      isLoading: true,
      error: "",
    }));

    void fetchActiveGroupWords()
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setState({
          activeGroup: payload.activeGroup ?? null,
          mappedTerms: Array.isArray(payload.mappedTerms) ? payload.mappedTerms : [],
          isLoading: false,
          error: "",
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setState({
          activeGroup: null,
          mappedTerms: [],
          isLoading: false,
          error: error.message || "Failed to load active-group words.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [shouldScopeByGroup, user?.id]);

  const mappedSet = useMemo(
    () => new Set(state.mappedTerms.map((value) => normalizeTerm(value)).filter(Boolean)),
    [state.mappedTerms],
  );

  const scopedWords = useMemo(() => {
    if (!shouldScopeByGroup) {
      return words;
    }
    if (!state.activeGroup) {
      return [];
    }
    if (mappedSet.size === 0) {
      return [];
    }

    return words.filter((word) => mappedSet.has(normalizeTerm(word.term)));
  }, [mappedSet, shouldScopeByGroup, state.activeGroup, words]);

  const scopeReason = !shouldScopeByGroup
    ? "not-scoped"
    : !state.activeGroup
      ? "no-active-group"
      : mappedSet.size === 0
        ? "active-group-empty"
        : scopedWords.length === 0
          ? "no-matches"
          : "ok";

  return {
    activeGroup: state.activeGroup,
    isScoped: shouldScopeByGroup,
    isLoadingScope: state.isLoading,
    scopeError: state.error,
    scopeReason,
    scopedWords,
  };
}
