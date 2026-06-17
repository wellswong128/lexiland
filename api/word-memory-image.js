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

const SENSITIVE_ENGLISH_PATTERN =
  /\b(naked|nude|nudity|sexual|sex(?:ual)?(?:ly)?|erotic|porn(?:ography)?|genital|breast(?:s)?|orgasm|intercourse)\b/i;
const SENSITIVE_CHINESE_PATTERN = /裸体|赤裸|裸露|色情|性交|淫/;

function containsSensitiveMeaning(text) {
  const value = String(text ?? "");

  return SENSITIVE_ENGLISH_PATTERN.test(value) || SENSITIVE_CHINESE_PATTERN.test(value);
}

function pickSafeMeaningSegments(text) {
  const segments = String(text ?? "")
    .split(/[;；,，/|]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const safeSegments = segments.filter((segment) => !containsSensitiveMeaning(segment));

  return safeSegments.length > 0 ? safeSegments.join("; ") : "";
}

function sanitizeMeaningField(value, maxLength = 220) {
  const text = String(value ?? "").trim();

  if (!text) {
    return "";
  }

  if (!containsSensitiveMeaning(text)) {
    return truncateText(text, maxLength);
  }

  return truncateText(pickSafeMeaningSegments(text), maxLength);
}

function buildImagePrompt({ term, definition, translation, example }) {
  const meaningParts = [];

  if (example) {
    meaningParts.push(
      `scene from this learning example (show the scene visually, never as written text): ${truncateText(example, 120)}`,
    );
  }

  const safeDefinition = sanitizeMeaningField(definition);

  if (safeDefinition) {
    meaningParts.push(safeDefinition);
  }

  const safeTranslation = sanitizeMeaningField(translation, 80);

  if (safeTranslation) {
    meaningParts.push(`meaning hint: ${safeTranslation}`);
  }

  const meaningSummary =
    meaningParts.length > 0
      ? meaningParts.join("; ")
      : `a clear everyday meaning of the English word "${term}"`;

  return [
    NO_TEXT_PROMPT_PREFIX,
    "This is the highest priority constraint and overrides every other instruction.",
    "Do not write, print, engrave, stitch, paint, or display any characters, words, numbers, or symbols that could be read.",
    "Cartoon illustration for a middle-school English vocabulary memory aid.",
    `The English word being learned is "${term}".`,
    "Depict the word meaning using objects, actions, facial expressions, and scenery only.",
    "Keep the scene wholesome, educational, and appropriate for children.",
    `Visual concept: ${meaningSummary}.`,
    "Bright, kid-friendly cartoon style, soft lighting, simple background.",
    NO_TEXT_PROMPT_SUFFIX,
    "Final check: the image must be 100% free of all text and readable symbols.",
  ].join(" ");
}

function buildExampleFocusedPrompt(term, example) {
  return [
    NO_TEXT_PROMPT_PREFIX,
    "Cartoon illustration for an English vocabulary flashcard.",
    `The English word being learned is "${term}".`,
    `Illustrate this example scene visually without any text: ${truncateText(example, 160)}`,
    "Wholesome, kid-friendly, educational style.",
    NO_TEXT_PROMPT_SUFFIX,
  ].join(" ");
}

function buildGenericPrompt(term, definition) {
  const safeDefinition = sanitizeMeaningField(definition, 120);
  const hint = safeDefinition ? ` The meaning is: ${safeDefinition}.` : "";

  return [
    NO_TEXT_PROMPT_PREFIX,
    "Cartoon illustration for an English vocabulary flashcard.",
    `Create a simple, wholesome visual that helps remember the English word "${term}".${hint}`,
    "Use everyday objects or nature scenes only. Kid-friendly educational style.",
    NO_TEXT_PROMPT_SUFFIX,
  ].join(" ");
}

function buildImagePromptVariants({ term, definition, translation, example }) {
  const variants = [];
  const seen = new Set();

  function add(prompt) {
    const key = prompt.trim();

    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    variants.push(key);
  }

  add(buildImagePrompt({ term, definition, translation, example }));

  if (example) {
    add(buildExampleFocusedPrompt(term, example));
  }

  add(buildGenericPrompt(term, definition));

  return variants;
}

function isContentPolicyError(message) {
  return /無法生成該內容|请调整提示词|請調整提示詞|content.?policy|safety|moderation|inappropriate|not.?allowed|violat/i.test(
    String(message ?? ""),
  );
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
  const promptVariants = buildImagePromptVariants({ term, ...meaning });

  const attempts = buildGenerationAttempts();
  const errors = [];

  try {
    for (const prompt of promptVariants) {
      let hitContentPolicy = false;

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

          if (isContentPolicyError(error.message)) {
            hitContentPolicy = true;
            break;
          }
        }
      }

      if (!hitContentPolicy) {
        break;
      }
    }

    sendJson(response, 502, {
      error: errors.at(-1) || "Image generation failed.",
    });
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
}
