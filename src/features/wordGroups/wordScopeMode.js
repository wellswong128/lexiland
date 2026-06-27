export const WORD_SCOPE_MODES = {
  GROUP: "group",
  CUSTOM: "custom",
};

export const WORD_SCOPE_MODE_CHANGED_EVENT = "lexiland:word-scope-mode-changed";

function getStorageKey(userId) {
  return userId ? `lexiland.wordScopeMode.${userId}` : "lexiland.wordScopeMode";
}

export function loadWordScopeMode(userId) {
  if (typeof window === "undefined") {
    return WORD_SCOPE_MODES.GROUP;
  }

  const stored = window.localStorage.getItem(getStorageKey(userId));
  return stored === WORD_SCOPE_MODES.CUSTOM
    ? WORD_SCOPE_MODES.CUSTOM
    : WORD_SCOPE_MODES.GROUP;
}

export function saveWordScopeMode(userId, mode, { notify = true } = {}) {
  if (typeof window === "undefined") {
    return;
  }

  const nextMode =
    mode === WORD_SCOPE_MODES.CUSTOM ? WORD_SCOPE_MODES.CUSTOM : WORD_SCOPE_MODES.GROUP;
  window.localStorage.setItem(getStorageKey(userId), nextMode);

  if (notify) {
    window.dispatchEvent(
      new CustomEvent(WORD_SCOPE_MODE_CHANGED_EVENT, { detail: { mode: nextMode } }),
    );
  }
}
