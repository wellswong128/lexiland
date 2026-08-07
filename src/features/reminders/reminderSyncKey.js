export function buildReminderSyncKey(userId, snapshot) {
  return JSON.stringify({
    snapshot,
    userId: String(userId || ""),
  });
}
