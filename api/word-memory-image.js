const AGNES_IMAGE_API_URL = "https://apihub.agnes-ai.com/v1/images/generations";
const DEFAULT_IMAGE_MODEL = "agnes-image-2.1-flash";
const FALLBACK_IMAGE_MODEL = "agnes-image-2.0-flash";
const SUPPORTED_IMAGE_SIZE = "1024x768";

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

function truncateText(value, maxLength = 220) {
  const text = String(value ?? "").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1)}…`;
}

function buildImagePrompt({ term, definition, translation, partOfSpeech, example }) {
  const meaningParts = [];

  if (definition) {
    meaningParts.push(truncateText(definition));
  }

  if (translation) {
    meaningParts.push(`meaning concept: ${truncateText(translation, 80)}`);
  }

  if (example) {
    meaningParts.push(`scene idea: ${truncateText(example, 120)}`);
  }

  const meaningSummary =
    meaningParts.length > 0
      ? meaningParts.join("; ")
      : `a visual idea related to ${term}`;

  return [
    "Text-free cartoon illustration for a vocabulary memory aid.",
    "No text, letters, numbers, captions, labels, signs, speech bubbles, logos, or watermarks.",
    `Illustrate this meaning visually without writing the word ${term}${partOfSpeech ? ` (${partOfSpeech})` : ""}: ${meaningSummary}.`,
    "Use objects, actions, and expressions only.",
    "Bright, kid-friendly cartoon style, soft lighting, simple background.",
  ].join(" ");
}

function parseImageApiError(errorText) {
  try {
    const data = JSON.parse(errorText);
    const message = String(data.error?.message ?? data.error ?? errorText).trim();

    if (/internal server error|upstream_error|500/i.test(message)) {
      return "The image service is temporarily unavailable. Please try again.";
    }

    return message;
  } catch {
    return errorText;
  }
}

function buildGenerationAttempts() {
  const preferredModel = process.env.AGNES_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
  const preferredSize = process.env.AGNES_IMAGE_SIZE || SUPPORTED_IMAGE_SIZE;
  const attempts = [];
  const seen = new Set();

  function addAttempt(model, size) {
    const key = `${model}:${size}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    attempts.push({ model, size });
  }

  addAttempt(preferredModel, preferredSize);

  if (preferredSize !== SUPPORTED_IMAGE_SIZE) {
    addAttempt(preferredModel, SUPPORTED_IMAGE_SIZE);
  }

  if (preferredModel !== FALLBACK_IMAGE_MODEL) {
    addAttempt(FALLBACK_IMAGE_MODEL, SUPPORTED_IMAGE_SIZE);
  }

  return attempts;
}

async function requestImageGeneration({ apiKey, model, prompt, size }) {
  const imageResponse = await fetch(AGNES_IMAGE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      extra_body: {
        response_format: "url",
      },
    }),
  });

  const responseText = await imageResponse.text();
  let data = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = null;
    }
  }

  if (!imageResponse.ok) {
    const error = new Error(parseImageApiError(responseText));
    error.statusCode = imageResponse.status;
    throw error;
  }

  const imageUrl = data?.data?.[0]?.url;

  if (!imageUrl) {
    throw new Error("Image generation did not return an image URL.");
  }

  return { imageUrl, model, size };
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

  if (!term) {
    sendJson(response, 400, { error: "Please provide an English word." });
    return;
  }

  const prompt = buildImagePrompt({
    term,
    definition: String(body.definition ?? "").trim(),
    translation: String(body.translation ?? "").trim(),
    partOfSpeech: String(body.partOfSpeech ?? "").trim(),
    example: String(body.example ?? "").trim(),
  });

  const attempts = buildGenerationAttempts();
  const errors = [];

  try {
    for (const attempt of attempts) {
      try {
        const result = await requestImageGeneration({
          apiKey,
          model: attempt.model,
          prompt,
          size: attempt.size,
        });

        sendJson(response, 200, {
          imageUrl: result.imageUrl,
          prompt,
          model: result.model,
          size: result.size,
        });
        return;
      } catch (error) {
        errors.push(`${attempt.model} @ ${attempt.size}: ${error.message}`);
      }
    }

    sendJson(response, 502, {
      error: errors.at(-1) || "Image generation failed.",
    });
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
}
