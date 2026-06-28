import { useCallback, useEffect, useMemo, useState } from "react";
import { hasSupabaseConfig } from "../../lib/supabaseClient.js";
import { normalizeTerm } from "../words/wordTypes.js";
import { ACTIVE_GROUP_CHANGED_EVENT } from "./wordGroupScopeEvents.js";
import {
  clearCachedActiveGroupScope,
  loadCachedActiveGroupScope,
  saveCachedActiveGroupScope,
} from "./activeGroupScopeCache.js";
import {
  fetchUserActiveGroupWords,
  invalidateUserActiveGroupWordsCache,
  ACTIVE_GROUP_INITIAL_IMPORT_COUNT,
} from "./wordGroupsApi.js";
import {
  loadWordScopeMode,
  saveWordScopeMode,
  WORD_SCOPE_MODE_CHANGED_EVENT,
  WORD_SCOPE_MODES,
} from "./wordScopeMode.js";

export function useActiveGroupWordScope(words, user) {
  const shouldScopeByGroup = hasSupabaseConfig && Boolean(user);
  const initialScopeMode = loadWordScopeMode(user?.id);
  const initialCachedScope = loadCachedActiveGroupScope(user?.id);

  const [state, setState] = useState(() => ({
    activeGroup: initialCachedScope?.activeGroup ?? null,
    mappedTerms: initialCachedScope?.mappedTerms ?? [],
    isLoading:
      shouldScopeByGroup &&
      initialScopeMode === WORD_SCOPE_MODES.GROUP &&
      !initialCachedScope?.activeGroup,
    error: "",
  }));
  const [scopeMode, setScopeMode] = useState(() => initialScopeMode);

  const wantsGroupScope =
    shouldScopeByGroup && scopeMode === WORD_SCOPE_MODES.GROUP;
  const isUsingCustomWords =
    shouldScopeByGroup && Boolean(state.activeGroup) && scopeMode === WORD_SCOPE_MODES.CUSTOM;
  const isGroupScopeActive =
    wantsGroupScope && (Boolean(state.activeGroup) || state.isLoading);

  useEffect(() => {
    setScopeMode(loadWordScopeMode(user?.id));
    const cachedScope = loadCachedActiveGroupScope(user?.id);
    setState((current) => ({
      ...current,
      activeGroup: cachedScope?.activeGroup ?? current.activeGroup,
      mappedTerms: cachedScope?.mappedTerms ?? current.mappedTerms,
    }));
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

  const loadScope = useCallback(async ({ forceRefresh = false } = {}) => {
    if (!shouldScopeByGroup) {
      setState({
        activeGroup: null,
        mappedTerms: [],
        isLoading: false,
        error: "",
      });
      return;
    }

    setState((current) => {
      const hasCachedData = Boolean(current.activeGroup) || current.mappedTerms.length > 0;

      return {
        ...current,
        isLoading: !hasCachedData,
        error: "",
      };
    });

    try {
      invalidateUserActiveGroupWordsCache();
      const payload = await fetchUserActiveGroupWords({
        forceRefresh,
        wordLimit: loadWordScopeMode(user?.id) === WORD_SCOPE_MODES.GROUP
          ? ACTIVE_GROUP_INITIAL_IMPORT_COUNT
          : 0,
      });
      const activeGroup = payload.activeGroup ?? null;
      const mappedTerms = Array.isArray(payload.mappedTerms) ? payload.mappedTerms : [];

      if (user?.id) {
        saveCachedActiveGroupScope(user.id, { activeGroup, mappedTerms });
      }

      setState({
        activeGroup,
        mappedTerms,
        isLoading: false,
        error: "",
      });
    } catch (error) {
      if (user?.id) {
        clearCachedActiveGroupScope(user.id);
      }

      setState({
        activeGroup: null,
        mappedTerms: [],
        isLoading: false,
        error: error.message || "Failed to load active-group words.",
      });
    }
  }, [shouldScopeByGroup, user?.id]);

  useEffect(() => {
    void loadScope();
  }, [loadScope]);

  useEffect(() => {
    if (!shouldScopeByGroup || typeof window === "undefined") {
      return undefined;
    }

    const handleActiveGroupChanged = (event) => {
      invalidateUserActiveGroupWordsCache();
      if (loadWordScopeMode(user?.id) !== WORD_SCOPE_MODES.GROUP) {
        saveWordScopeMode(user?.id, WORD_SCOPE_MODES.GROUP, { notify: false });
      }
      setScopeMode(WORD_SCOPE_MODES.GROUP);

      const nextActiveGroup = event?.detail?.activeGroup ?? null;
      const nextMappedTerms = event?.detail?.mappedTerms;

      if (nextActiveGroup && Array.isArray(nextMappedTerms)) {
        if (user?.id) {
          saveCachedActiveGroupScope(user.id, {
            activeGroup: nextActiveGroup,
            mappedTerms: nextMappedTerms,
          });
        }

        setState({
          activeGroup: nextActiveGroup,
          mappedTerms: nextMappedTerms,
          isLoading: false,
          error: "",
        });
        return;
      }

      void loadScope({ forceRefresh: true });
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
  const mappedTermCount = mappedSet.size;
  const missingMappedTermCount = isGroupScopeActive
    ? Math.max(0, mappedTermCount - scopedWords.length)
    : 0;

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
    mappedTermCount,
    missingMappedTermCount,
    scopedWords,
    switchToCustomWords,
    switchToGroupWords,
  };
}
