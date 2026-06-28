import { useCallback, useEffect, useState } from "react";
import { hasSupabaseConfig } from "../../lib/supabaseClient.js";
import { ACTIVE_GROUP_SCOPE_LOADED_EVENT } from "./wordGroupScopeEvents.js";
import {
  clearCachedActiveGroupScope,
  loadCachedActiveGroupScope,
  saveCachedActiveGroupScope,
} from "./activeGroupScopeCache.js";
import {
  fetchUserActiveGroupWords,
  invalidateUserActiveGroupWordsCache,
} from "./wordGroupsApi.js";
import {
  loadWordScopeMode,
  saveWordScopeMode,
  WORD_SCOPE_MODE_CHANGED_EVENT,
  WORD_SCOPE_MODES,
} from "./wordScopeMode.js";

const SCOPE_FETCH_TIMEOUT_MS = 30_000;

function readCachedScope(userId) {
  return loadCachedActiveGroupScope(userId);
}

function hasCachedScopeData(cachedScope) {
  return Boolean(cachedScope?.activeGroup) || (cachedScope?.mappedTerms?.length ?? 0) > 0;
}

function fetchActiveGroupScopeWithTimeout(options) {
  return Promise.race([
    fetchUserActiveGroupWords(options),
    new Promise((_, reject) => {
      window.setTimeout(
        () => reject(new Error("Timed out loading active group words.")),
        SCOPE_FETCH_TIMEOUT_MS,
      );
    }),
  ]);
}

export function useActiveGroupScopeLoader(user) {
  const userId = user?.id ?? null;
  const shouldScopeByGroup = hasSupabaseConfig && Boolean(userId);
  const initialScopeMode = loadWordScopeMode(userId);
  const initialCachedScope = readCachedScope(userId);

  const [state, setState] = useState(() => ({
    activeGroup: initialCachedScope?.activeGroup ?? null,
    mappedTerms: initialCachedScope?.mappedTerms ?? [],
    isLoading:
      shouldScopeByGroup &&
      initialScopeMode === WORD_SCOPE_MODES.GROUP &&
      !hasCachedScopeData(initialCachedScope),
    error: "",
  }));
  const [scopeMode, setScopeMode] = useState(() => initialScopeMode);

  useEffect(() => {
    const cachedScope = readCachedScope(userId);
    setScopeMode(loadWordScopeMode(userId));
    setState((current) => ({
      ...current,
      activeGroup: cachedScope?.activeGroup ?? current.activeGroup,
      mappedTerms: cachedScope?.mappedTerms ?? current.mappedTerms,
      isLoading: hasCachedScopeData(cachedScope) ? false : current.isLoading,
    }));
  }, [userId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleScopeModeChanged = () => {
      setScopeMode(loadWordScopeMode(userId));
    };

    window.addEventListener(WORD_SCOPE_MODE_CHANGED_EVENT, handleScopeModeChanged);
    return () => {
      window.removeEventListener(WORD_SCOPE_MODE_CHANGED_EVENT, handleScopeModeChanged);
    };
  }, [userId]);

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

    const cachedScope = readCachedScope(userId);
    const hasCachedData = hasCachedScopeData(cachedScope);

    setState((current) => ({
      ...current,
      activeGroup: cachedScope?.activeGroup ?? current.activeGroup,
      mappedTerms: cachedScope?.mappedTerms ?? current.mappedTerms,
      isLoading: !hasCachedData,
      error: "",
    }));

    try {
      invalidateUserActiveGroupWordsCache();
      const payload = await fetchActiveGroupScopeWithTimeout({
        forceRefresh,
      });
      const activeGroup = payload.activeGroup ?? null;
      const mappedTerms = Array.isArray(payload.mappedTerms) ? payload.mappedTerms : [];

      if (userId) {
        saveCachedActiveGroupScope(userId, { activeGroup, mappedTerms });
      }

      setState({
        activeGroup,
        mappedTerms,
        isLoading: false,
        error: "",
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(ACTIVE_GROUP_SCOPE_LOADED_EVENT, {
            detail: { mappedTermCount: mappedTerms.length },
          }),
        );
      }
    } catch (error) {
      if (userId && !hasCachedData) {
        clearCachedActiveGroupScope(userId);
      }

      setState((current) => ({
        activeGroup: hasCachedData ? current.activeGroup : null,
        mappedTerms: hasCachedData ? current.mappedTerms : [],
        isLoading: false,
        error: error.message || "Failed to load active-group words.",
      }));
    }
  }, [shouldScopeByGroup, userId]);

  useEffect(() => {
    void loadScope();
  }, [loadScope]);

  useEffect(() => {
    if (!shouldScopeByGroup || typeof window === "undefined") {
      return undefined;
    }

    const handleActiveGroupChanged = (event) => {
      invalidateUserActiveGroupWordsCache();
      if (loadWordScopeMode(userId) !== WORD_SCOPE_MODES.GROUP) {
        saveWordScopeMode(userId, WORD_SCOPE_MODES.GROUP, { notify: false });
      }
      setScopeMode(WORD_SCOPE_MODES.GROUP);

      const nextActiveGroup = event?.detail?.activeGroup ?? null;
      const nextMappedTerms = event?.detail?.mappedTerms;

      if (nextActiveGroup && Array.isArray(nextMappedTerms)) {
        if (userId) {
          saveCachedActiveGroupScope(userId, {
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
  }, [loadScope, shouldScopeByGroup, userId]);

  const switchToCustomWords = useCallback(() => {
    saveWordScopeMode(userId, WORD_SCOPE_MODES.CUSTOM);
    setScopeMode(WORD_SCOPE_MODES.CUSTOM);
  }, [userId]);

  const switchToGroupWords = useCallback(() => {
    saveWordScopeMode(userId, WORD_SCOPE_MODES.GROUP);
    setScopeMode(WORD_SCOPE_MODES.GROUP);
  }, [userId]);

  const wantsGroupScope = shouldScopeByGroup && scopeMode === WORD_SCOPE_MODES.GROUP;
  const isUsingCustomWords =
    shouldScopeByGroup && Boolean(state.activeGroup) && scopeMode === WORD_SCOPE_MODES.CUSTOM;
  const hasScopeData = Boolean(state.activeGroup) || state.mappedTerms.length > 0;
  const isGroupScopeActive =
    wantsGroupScope && (Boolean(state.activeGroup) || (state.isLoading && !hasScopeData));

  return {
    activeGroup: state.activeGroup,
    error: state.error,
    isGroupScopeActive,
    isLoading: state.isLoading && !hasScopeData,
    isScoped: shouldScopeByGroup,
    isUsingCustomWords,
    mappedTerms: state.mappedTerms,
    scopeMode,
    switchToCustomWords,
    switchToGroupWords,
  };
}
