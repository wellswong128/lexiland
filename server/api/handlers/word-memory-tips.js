import { requireAiApiAccess, sendAuthError } from "../_authz.js";
import { isAiJsonOutputError, parseAgnesJson } from "../_parse-agnes-json.js";

const AGNES_API_URL = "https://apihub.agnes-ai.com/v1/chat/completions";
const AI_OUTPUT_RETRY_ATTEMPTS = 3;

const LOCALE_LABELS = {
  "zh-Hant": "Traditional Chinese",
  "zh-Hans": "Simplified Chinese",
  en: "English",
};

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

function normalizeTips(value) {
  const tips = Array.isArray(value?.tips)
    ? value.tips
        .map((tip) => ({
          method: String(tip?.method ?? "").trim(),
          content: String(tip?.content ?? "").trim(),
        }))
        .filter((tip) => tip.method && tip.content)
    : [];

  return {
    summary: String(value?.summary ?? "").trim(),
    tips: tips.slice(0, 5),
  };
}

function buildPrompt({ term, definition, translation, partOfSpeech, example, locale }) {
  const language = LOCALE_LABELS[locale] || LOCALE_LABELS["zh-Hant"];

  return `Give practical memory tips for this English vocabulary word.

Word: ${term}
Definition: ${definition || "unknown"}
Translation: ${translation || "unknown"}
Part of speech: ${partOfSpeech || "unknown"}
Example: ${example || "none"}

Write all output in ${language}. Use learner-friendly language suitable for a middle-school English learner.

Return only valid JSON with:
- summary: one short memorable hook sentence
- tips: an array of 3 to 4 objects, each with:
  - method: a short label such as phonetic link, root breakdown, image association, sentence trick, or confusable warning
  - content: 1-2 concise sentences explaining how to remember the word

Use plain double quotes in JSON strings. Escape any internal quotes with backslashes. Do not use smart quotes or unescaped quotation marks inside values.

Prioritize methods that fit this specific word. Avoid generic advice like "repeat many times".`;
}

async function requestMemoryTips(apiKey, body, locale) {
  const term = String(body.term ?? "").trim();
  let lastError = null;

  for (let attempt = 0; attempt < AI_OUTPUT_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const aiResponse = await fetch(AGNES_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.AGNES_MODEL || "agnes-2.0-flash",
          messages: [
            {
              role: "system",
              content:
                "You are a vocabulary coach helping learners remember English words. Return only valid JSON.",
            },
            {
              role: "user",
              content: buildPrompt({
                term,
                definition: String(body.definition ?? "").trim(),
                translation: String(body.translation ?? "").trim(),
                partOfSpeech: String(body.partOfSpeech ?? "").trim(),
                example: String(body.example ?? "").trim(),
                locale,
              }),
            },
          ],
          temperature: 0.4,
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        throw new Error(`AI request failed: ${errorText}`);
      }

      const data = await aiResponse.json();
      const memoryTips = normalizeTips(parseAgnesJson(data));

      if (memoryTips.tips.length === 0) {
        throw new Error("AI response did not include memory tips.");
      }

      return memoryTips;
    } catch (error) {
      lastError = error;
      if (attempt < AI_OUTPUT_RETRY_ATTEMPTS - 1 && isAiJsonOutputError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error("AI memory tips request failed.");
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

  const apiKey = process.env.AGNES_API_KEY;

  if (!apiKey) {
    sendJson(response, 500, {
      error: "AGNES_API_KEY is not configured on the server.",
    });
    return;
  }

  const body = getRequestBody(request);
  const term = String(body.term ?? "").trim();
  const locale = String(body.locale ?? "zh-Hant").trim();

  if (!term) {
    sendJson(response, 400, { error: "Please provide an English word." });
    return;
  }

  try {
    const memoryTips = await requestMemoryTips(apiKey, body, locale);
    sendJson(response, 200, { memoryTips });
  } catch (error) {
    const statusCode = isAiJsonOutputError(error) ? 502 : 500;
    sendJson(response, statusCode, { error: error.message });
  }
}
