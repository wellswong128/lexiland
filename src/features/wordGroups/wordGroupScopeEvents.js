export const ACTIVE_GROUP_CHANGED_EVENT = "lexiland:active-group-changed";
export const ACTIVE_GROUP_SCOPE_LOADED_EVENT = "lexiland:active-group-scope-loaded";

export function notifyActiveGroupChanged(detail = {}) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ACTIVE_GROUP_CHANGED_EVENT, { detail }));
  }
}
