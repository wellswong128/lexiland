const AGNES_IMAGE_API_URL = "https://apihub.agnes-ai.com/v1/images/generations";
const DEFAULT_IMAGE_MODEL = "agnes-image-2.1-flash";
const FALLBACK_IMAGE_MODEL = "agnes-image-2.0-flash";
const SUPPORTED_IMAGE_SIZE = "1024x768";

const NO_TEXT_NEGATIVE_PROMPT = [
  "text",
  "words",
  "letters",
  "alphabet",
  "writing",
  "written language",
  "readable characters",
  "caption",
  "subtitles",
  "title",
  "label",
  "name tag",
  "sign",
  "signage",
  "street sign",
  "shop sign",
  "billboard",
  "poster",
  "banner",
  "logo",
  "brand mark",
  "watermark",
  "speech bubble",
  "thought bubble",
  "comic bubble",
  "typography",
  "font",
  "handwriting",
  "calligraphy",
  "graffiti",
  "inscription",
  "embroidery text",
  "carved letters",
  "numbers",
  "digits",
  "date stamp",
  "clock face numbers",
  "book page",
  "newspaper",
  "magazine",
  "document",
  "certificate",
  "menu",
  "screen text",
  "UI text",
  "phone screen text",
  "computer screen text",
  "keyboard letters",
  "Chinese characters",
  "Japanese characters",
  "Korean characters",
  "Arabic script",
  "Cyrillic letters",
  "Latin letters",
  "punctuation as writing",
  "subtitle bar",
  "closed captions",
].join(", ");

const NO_TEXT_PROMPT_PREFIX =
  "STRICT RULE: Generate a completely text-free illustration. The image must not contain any text, letters, numbers, symbols used as writing, captions, labels, signs, logos, watermarks, speech bubbles, or readable characters in any language.";

const NO_TEXT_PROMPT_SUFFIX =
  "Remember: absolutely no text anywhere in the image. Pure visual storytelling with objects, actions, scenery, colors, and expressions only.";

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

function buildImagePrompt({ definition, translation, example }) {
  const meaningParts = [];

  if (definition) {
    meaningParts.push(truncateText(definition));
  }

  if (translation) {
    meaningParts.push(`meaning concept: ${truncateText(translation, 80)}`);
  }

  if (example) {
    meaningParts.push(
      `visual scene idea inspired by this context, never render the sentence as written text: ${truncateText(example, 120)}`,
    );
  }

  const meaningSummary =
    meaningParts.length > 0
      ? meaningParts.join("; ")
      : "a clear visual concept for the word meaning";

  return [
    NO_TEXT_PROMPT_PREFIX,
    "This is the highest priority constraint and overrides every other instruction.",
    "Do not write, print, engrave, stitch, paint, or display any characters, words, numbers, or symbols that could be read.",
    "Cartoon illustration for a vocabulary memory aid.",
    "Depict the meaning using objects, actions, facial expressions, and scenery only.",
    `Visual concept: ${meaningSummary}.`,
    "Bright, kid-friendly cartoon style, soft lighting, simple background.",
    NO_TEXT_PROMPT_SUFFIX,
    "Final check: the image must be 100% free of all text and readable symbols.",
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
        negative_prompt: `${NO_TEXT_NEGATIVE_PROMPT}, readable, subtitle, lettering, wordmark`,
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

  const meaning = {
    definition: String(body.definition ?? "").trim(),
    translation: String(body.translation ?? "").trim(),
    example: String(body.example ?? "").trim(),
  };
  const prompt = buildImagePrompt(meaning);

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
