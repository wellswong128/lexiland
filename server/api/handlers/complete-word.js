import { requireAiApiAccess, sendAuthError } from "../_authz.js";
import { generateCompleteWordSuggestion } from "../_complete-word-suggestion.js";
import { isAiJsonOutputError } from "../_parse-agnes-json.js";

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

function getRequestBody(request) {
  if (typeof request.body === "string") {
    return JSON.parse(request.body || "{}");
  }

  return request.body ?? {};
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  try {
    await requireAiApiAccess(request);
  } catch (error) {
    sendAuthError(response, error);
    return;
  }

  const body = getRequestBody(request);
  const term = String(body.term ?? "").trim();
  const vocabularyLocale = String(body.vocabularyLocale ?? body.locale ?? "zh-Hant").trim();

  if (!term) {
    sendJson(response, 400, { error: "Please provide an English word." });
    return;
  }

  try {
    const suggestion = await generateCompleteWordSuggestion(term, vocabularyLocale);
    sendJson(response, 200, { suggestion });
  } catch (error) {
    const statusCode = isAiJsonOutputError(error) ? 502 : 500;
    sendJson(response, statusCode, { error: error.message });
  }
}
