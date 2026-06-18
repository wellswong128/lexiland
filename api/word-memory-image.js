import { imageContainsReadableText } from "../lib/detectImageText.js";
import { fetchWithTimeout } from "../lib/fetchWithTimeout.js";
import { buildNegativePrompt, wrapNoTextPrompt } from "../lib/noTextImageRules.js";

const AGNES_IMAGE_API_URL = "https://apihub.agnes-ai.com/v1/images/generations";
const DEFAULT_IMAGE_MODEL = "agnes-image-2.1-flash";
const FALLBACK_IMAGE_MODEL = "agnes-image-2.0-flash";
const SUPPORTED_IMAGE_SIZE = "1024x768";
const DEFAULT_GENERATION_TIMEOUT_MS = 45000;
const DEFAULT_MAX_GENERATIONS = 3;
const DEFAULT_MAX_TEXT_CHECKS = 2;

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

function describeConceptWithoutRenderingWord(term) {
  return `Illustrate the everyday meaning of one English vocabulary concept. The concept name is for guidance only and must never appear as visible text: ${term}.`;
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
    meaningParts.push(`meaning hint for the illustrator only: ${safeTranslation}`);
  }

  const meaningSummary =
    meaningParts.length > 0
      ? meaningParts.join("; ")
      : "a clear everyday visual meaning for a common English vocabulary concept";

  return wrapNoTextPrompt([
    "Cartoon illustration for a middle-school English vocabulary memory aid.",
    describeConceptWithoutRenderingWord(term),
    "Depict the meaning using objects, actions, facial expressions, and scenery only.",
    "Keep the scene wholesome, educational, and appropriate for children.",
    `Visual concept: ${meaningSummary}.`,
    "Bright, kid-friendly cartoon style, soft lighting, simple background.",
  ]);
}

function buildExampleFocusedPrompt(term, example) {
  return wrapNoTextPrompt([
    "Cartoon illustration for an English vocabulary flashcard.",
    describeConceptWithoutRenderingWord(term),
    `Illustrate this example scene visually without any text: ${truncateText(example, 160)}`,
    "Wholesome, kid-friendly, educational style.",
  ]);
}

function buildGenericPrompt(term, definition) {
  const safeDefinition = sanitizeMeaningField(definition, 120);
  const hint = safeDefinition ? ` The meaning is: ${safeDefinition}.` : "";

  return wrapNoTextPrompt([
    "Cartoon illustration for an English vocabulary flashcard.",
    describeConceptWithoutRenderingWord(term),
    `Create a simple, wholesome visual that helps remember this vocabulary concept.${hint}`,
    "Use everyday objects or nature scenes only. Kid-friendly educational style.",
  ]);
}

function buildUltraMinimalNoTextPrompt(term) {
  return wrapNoTextPrompt([
    "Ultra-simple cartoon scene with a plain background.",
    describeConceptWithoutRenderingWord(term),
    "Show one clear object or action only.",
    "No books, screens, signs, papers, labels, packaging, clothing text, or objects that usually contain writing.",
    "Flat colors, minimal detail, wholesome and kid-friendly.",
  ]);
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
  add(buildUltraMinimalNoTextPrompt(term));

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

function buildGenerationPlan({ term, definition, translation, example }) {
  const promptVariants = buildImagePromptVariants({ term, definition, translation, example });
  const modelAttempts = buildGenerationAttempts();
  const primaryPrompt = promptVariants[0];
  const genericPrompt = promptVariants.find((prompt) => prompt !== primaryPrompt) ?? primaryPrompt;
  const minimalPrompt = promptVariants.at(-1) ?? primaryPrompt;
  const primaryModel = modelAttempts[0];
  const fallbackModel = modelAttempts.at(-1) ?? primaryModel;

  const plan = [
    { prompt: primaryPrompt, model: primaryModel.model, size: primaryModel.size, checkText: true },
    { prompt: genericPrompt, model: primaryModel.model, size: primaryModel.size, checkText: true },
    {
      prompt: minimalPrompt,
      model: fallbackModel.model,
      size: fallbackModel.size,
      checkText: false,
    },
  ];

  const seen = new Set();

  return plan.filter((entry) => {
    const key = `${entry.prompt}:${entry.model}:${entry.size}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getGenerationLimits() {
  return {
    maxGenerations: Number(process.env.AGNES_IMAGE_MAX_ATTEMPTS) || DEFAULT_MAX_GENERATIONS,
    maxTextChecks: Number(process.env.AGNES_IMAGE_MAX_TEXT_CHECKS) || DEFAULT_MAX_TEXT_CHECKS,
    generationTimeoutMs:
      Number(process.env.AGNES_IMAGE_TIMEOUT_MS) || DEFAULT_GENERATION_TIMEOUT_MS,
  };
}

async function requestImageGeneration({
  apiKey,
  model,
  prompt,
  size,
  blockedTerms = [],
  timeoutMs = DEFAULT_GENERATION_TIMEOUT_MS,
}) {
  const imageResponse = await fetchWithTimeout(
    AGNES_IMAGE_API_URL,
    {
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
          negative_prompt: buildNegativePrompt(blockedTerms),
        },
      }),
    },
    timeoutMs,
  );

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
  const generationPlan = buildGenerationPlan({ term, ...meaning });
  const blockedTerms = [term, meaning.translation].filter(Boolean);
  const limits = getGenerationLimits();

  const errors = [];
  let generationCount = 0;
  let textCheckCount = 0;

  try {
    for (const step of generationPlan) {
      if (generationCount >= limits.maxGenerations) {
        break;
      }

      try {
        generationCount += 1;

        const result = await requestImageGeneration({
          apiKey,
          model: step.model,
          prompt: step.prompt,
          size: step.size,
          blockedTerms,
          timeoutMs: limits.generationTimeoutMs,
        });

        const shouldCheckText =
          step.checkText && textCheckCount < limits.maxTextChecks;

        if (shouldCheckText) {
          textCheckCount += 1;

          const hasReadableText = await imageContainsReadableText({
            apiKey,
            imageUrl: result.imageUrl,
          });

          if (hasReadableText) {
            errors.push(
              `${step.model} @ ${step.size}: rejected because the image contained readable text`,
            );
            continue;
          }
        }

        sendJson(response, 200, {
          imageUrl: result.imageUrl,
          prompt: step.prompt,
          model: result.model,
          size: result.size,
        });
        return;
      } catch (error) {
        errors.push(`${step.model} @ ${step.size}: ${error.message}`);

        if (isContentPolicyError(error.message)) {
          continue;
        }
      }
    }

    sendJson(response, 502, {
      error:
        errors.at(-1) ||
        "Image generation failed. The image service may be busy, please try again shortly.",
    });
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
}

export {
  buildExampleFocusedPrompt,
  buildGenericPrompt,
  buildGenerationPlan,
  buildImagePrompt,
  buildImagePromptVariants,
  buildUltraMinimalNoTextPrompt,
};
