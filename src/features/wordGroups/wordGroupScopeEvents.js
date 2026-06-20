export const ACTIVE_GROUP_CHANGED_EVENT = "lexiland:active-group-changed";

export function notifyActiveGroupChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ACTIVE_GROUP_CHANGED_EVENT));
  }
}
