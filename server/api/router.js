import adminUsers from "./handlers/admin-users.js";
import adminWordbase from "./handlers/admin-wordbase.js";
import adminWordbaseLibrary from "./handlers/admin-wordbase-library.js";
import adminWordGroupMap from "./handlers/admin-word-group-map.js";
import adminWordGroups from "./handlers/admin-word-groups.js";
import completeWord from "./handlers/complete-word.js";
import cronEveningReminders from "./handlers/cron-evening-reminders.js";
import extractWordsFromImage from "./handlers/extract-words-from-image.js";
import userActiveGroup from "./handlers/user-active-group.js";
import userActiveGroupWords from "./handlers/user-active-group-words.js";
import userDailySnapshot from "./handlers/user-daily-snapshot.js";
import userGroupPicks from "./handlers/user-group-picks.js";
import userReminderSettings from "./handlers/user-reminder-settings.js";
import wordGroups from "./handlers/word-groups.js";
import wordMemoryImage from "./handlers/word-memory-image.js";
import wordMemoryTips from "./handlers/word-memory-tips.js";
import wordbaseEntry from "./handlers/wordbase-entry.js";

const ROUTES = new Map([
  ["admin-users", adminUsers],
  ["admin-wordbase", adminWordbase],
  ["admin-wordbase-library", adminWordbaseLibrary],
  ["admin-word-group-map", adminWordGroupMap],
  ["admin-word-groups", adminWordGroups],
  ["complete-word", completeWord],
  ["cron/evening-reminders", cronEveningReminders],
  ["extract-words-from-image", extractWordsFromImage],
  ["user-active-group", userActiveGroup],
  ["user-active-group-words", userActiveGroupWords],
  ["user-daily-snapshot", userDailySnapshot],
  ["user-group-picks", userGroupPicks],
  ["user-reminder-settings", userReminderSettings],
  ["word-groups", wordGroups],
  ["word-memory-image", wordMemoryImage],
  ["word-memory-tips", wordMemoryTips],
  ["wordbase-entry", wordbaseEntry],
]);

function sendNotFound(response) {
  response.statusCode = 404;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({ error: "Not found." }));
}

export async function routeRequest(path, request, response) {
  const normalizedPath = String(path || "").trim().replace(/^\/+|\/+$/g, "");
  const handler = ROUTES.get(normalizedPath);

  if (!handler) {
    sendNotFound(response);
    return;
  }

  await handler(request, response);
}

export { ROUTES };
