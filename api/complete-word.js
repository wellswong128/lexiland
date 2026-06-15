const AGNES_API_URL = "https://apihub.agnes-ai.com/v1/chat/completions";

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

function normalizeSuggestion(value) {
  return {
    term: String(value?.term ?? "").trim(),
    definition: String(value?.definition ?? "").trim(),
    translation: String(value?.translation ?? "").trim(),
    pronunciation: String(value?.pronunciation ?? "").trim(),
    partOfSpeech: String(value?.partOfSpeech ?? "").trim(),
    example: String(value?.example ?? "").trim(),
    exampleTranslation: String(value?.exampleTranslation ?? "").trim(),
    tags: Array.isArray(value?.tags)
      ? value.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [],
  };
}

function parseAgnesJson(data) {
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("AI response did not include text output.");
  }

  return JSON.parse(text);
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
  const chineseLabel = LOCALE_LABELS[locale] || LOCALE_LABELS["zh-Hant"];

  if (!term) {
    sendJson(response, 400, { error: "Please provide an English word." });
    return;
  }

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
              "You help English learners create vocabulary cards. Return only valid JSON.",
          },
          {
            role: "user",
            content: `Create vocabulary data for this English word: ${term}

Return only valid JSON with these fields:
term, definition, translation, pronunciation, partOfSpeech, example, exampleTranslation, tags.

Use ${chineseLabel} for translation and exampleTranslation.
example must be a natural English sentence that uses the word.
exampleTranslation must be the ${chineseLabel} translation of example.
Keep the definition concise and learner-friendly. Tags should be an array of short English labels.`,
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      sendJson(response, aiResponse.status, {
        error: `AI request failed: ${errorText}`,
      });
      return;
    }

    const data = await aiResponse.json();
    const suggestion = normalizeSuggestion(parseAgnesJson(data));

    if (!suggestion.term || !suggestion.definition) {
      sendJson(response, 502, {
        error: "AI response was missing term or definition.",
      });
      return;
    }

    sendJson(response, 200, { suggestion });
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
}
