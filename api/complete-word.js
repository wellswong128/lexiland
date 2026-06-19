import {
  getVocabularyLocaleLabel,
  hasValidChineseTranslationFields,
  resolveVocabularyLocale,
} from "../lib/vocabularyLocale.js";

const AGNES_API_URL = "https://apihub.agnes-ai.com/v1/chat/completions";

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

function buildPrompt(term, chineseLabel, { strict = false } = {}) {
  const strictRule = strict
    ? `\nIMPORTANT: translation and exampleTranslation MUST be written in ${chineseLabel} using Chinese characters. Do NOT use English for those two fields.`
    : "";

  return `Create vocabulary data for this English word: ${term}

Return only valid JSON with these fields:
term, definition, translation, pronunciation, partOfSpeech, example, exampleTranslation, tags.

Use ${chineseLabel} for translation and exampleTranslation.
translation must be the ${chineseLabel} meaning of the word (not English).
example must be a natural English sentence that uses the word.
exampleTranslation must be the ${chineseLabel} translation of example.
Keep the definition concise and learner-friendly. Tags should be an array of short English labels.${strictRule}`;
}

async function requestSuggestion(term, chineseLabel, apiKey, { strict = false } = {}) {
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
          content: buildPrompt(term, chineseLabel, { strict }),
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text();
    throw new Error(`AI request failed: ${errorText}`);
  }

  const data = await aiResponse.json();

  return normalizeSuggestion(parseAgnesJson(data));
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
  const vocabularyLocale = resolveVocabularyLocale(
    String(body.vocabularyLocale ?? body.locale ?? "zh-Hant").trim(),
  );
  const chineseLabel = getVocabularyLocaleLabel(vocabularyLocale);

  if (!term) {
    sendJson(response, 400, { error: "Please provide an English word." });
    return;
  }

  try {
    let suggestion = await requestSuggestion(term, chineseLabel, apiKey);

    if (!hasValidChineseTranslationFields(suggestion)) {
      suggestion = await requestSuggestion(term, chineseLabel, apiKey, { strict: true });
    }

    if (!suggestion.term || !suggestion.definition) {
      sendJson(response, 502, {
        error: "AI response was missing term or definition.",
      });
      return;
    }

    if (!hasValidChineseTranslationFields(suggestion)) {
      sendJson(response, 502, {
        error: "AI response did not include Chinese translation fields.",
      });
      return;
    }

    sendJson(response, 200, { suggestion });
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
}
