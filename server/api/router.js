import adminUsers from "./handlers/admin-users.js";
import adminWordbase from "./handlers/admin-wordbase.js";
import adminWordbaseLibrary from "./handlers/admin-wordbase-library.js";
import adminWordGroupMap from "./handlers/admin-word-group-map.js";
import adminWordGroups from "./handlers/admin-word-groups.js";
import completeWord from "./handlers/complete-word.js";
import extractWordsFromImage from "./handlers/extract-words-from-image.js";
import userActiveGroup from "./handlers/user-active-group.js";
import userActiveGroupWords from "./handlers/user-active-group-words.js";
import userGroupPicks from "./handlers/user-group-picks.js";
import wordGroups from "./handlers/word-groups.js";
import wordMemoryImage from "./handlers/word-memory-image.js";
import wordMemoryTips from "./handlers/word-memory-tips.js";

const ROUTES = new Map([
  ["admin-users", adminUsers],
  ["admin-wordbase", adminWordbase],
  ["admin-wordbase-library", adminWordbaseLibrary],
  ["admin-word-group-map", adminWordGroupMap],
  ["admin-word-groups", adminWordGroups],
  ["complete-word", completeWord],
  ["extract-words-from-image", extractWordsFromImage],
  ["user-active-group", userActiveGroup],
  ["user-active-group-words", userActiveGroupWords],
  ["user-group-picks", userGroupPicks],
  ["word-groups", wordGroups],
  ["word-memory-image", wordMemoryImage],
  ["word-memory-tips", wordMemoryTips],
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
