import { imageContainsReadableText } from "../lib/detectImageText.js";
import { fetchWithTimeout } from "../lib/fetchWithTimeout.js";
import { buildNegativePrompt, buildVisualImagePrompt } from "../lib/noTextImageRules.js";
import { requireAiApiAccess, sendAuthError } from "./_authz.js";

const AGNES_IMAGE_API_URL = "https://apihub.agnes-ai.com/v1/images/generations";
const DEFAULT_IMAGE_MODEL = "agnes-image-2.1-flash";
const FALLBACK_IMAGE_MODEL = "agnes-image-2.0-flash";
const SUPPORTED_IMAGE_SIZE = "1024x768";
const DEFAULT_GENERATION_TIMEOUT_MS = 45000;
const DEFAULT_MAX_GENERATIONS = 8;
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
const POLICY_SENSITIVE_ENGLISH_PATTERN =
  /\b(worship\w*|prayer|pray(?:ing|er|s)?|religious|religion|church|temple|mosque|synagogue|god\b|goddess|sin(?:ner|ful)?|hell\b|devil|demon|sacred|holy\b|bible|quran|crucifix|altar|sacrifice|martyr|bless(?:ed|ing)?|spiritual\w*|clergy|priest|nun|monk|sermon|gospel|afterlife|soul\b|heaven\b|divine)\b/i;
const POLICY_SENSITIVE_CHINESE_PATTERN =
  /宗教|祈祷|祷告|信仰|教堂|寺庙|上帝|神(?:灵|圣)?|虔诚|地狱|魔鬼|灵魂|神圣|圣经|牺牲|祭/;
const POLICY_SENSITIVE_TERM_PATTERN =
  /\b(worship|prayer|sacred|blessing|heaven|sin|hell|crucifix|gospel|clergy|sermon)\b/i;

function containsSensitiveMeaning(text) {
  const value = String(text ?? "");

  return SENSITIVE_ENGLISH_PATTERN.test(value) || SENSITIVE_CHINESE_PATTERN.test(value);
}

function containsPolicySensitiveMeaning(...values) {
  const combined = values.map((value) => String(value ?? "")).join(" ");

  return (
    POLICY_SENSITIVE_ENGLISH_PATTERN.test(combined) ||
    POLICY_SENSITIVE_CHINESE_PATTERN.test(combined) ||
    POLICY_SENSITIVE_TERM_PATTERN.test(combined)
  );
}

function stripPolicySensitiveText(text) {
  const englishPattern = new RegExp(POLICY_SENSITIVE_ENGLISH_PATTERN.source, "gi");
  const chinesePattern = new RegExp(POLICY_SENSITIVE_CHINESE_PATTERN.source, "g");

  return String(text ?? "")
    .replace(englishPattern, " ")
    .replace(chinesePattern, " ")
    .replace(/\b(?:and|or|the|a|an)\b(?=\s*(?:[,.;]|$))/gi, " ")
    .replace(/(?:^|[\s,;])(?:and|or)\s+(?=[,.;]|$)/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*,/g, ",")
    .replace(/(?:,\s*)+$/g, "")
    .trim();
}

function needsPolicySafeFallbacks({ term, definition, example, translation }) {
  return containsPolicySensitiveMeaning(term, definition, example, translation);
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
  const text = stripPolicySensitiveText(String(value ?? "").trim());

  if (!text) {
    return "";
  }

  if (!containsSensitiveMeaning(text)) {
    return truncateText(text, maxLength);
  }

  return truncateText(pickSafeMeaningSegments(text), maxLength);
}


function inferSafeSceneFromMeaning({ term, definition, example, translation }) {
  const combined = `${term} ${definition} ${example} ${translation}`.toLowerCase();

  if (/devotion|loyal|dedication|commitment|faithful/.test(combined)) {
    return "A child gently caring for a small potted plant every day, showing patience and dedication";
  }

  if (/faith|trust|believe|belief/.test(combined)) {
    return "Two friends helping each other across a small bridge, showing trust and support";
  }

  if (/love|affection|care|caring|family|kindness/.test(combined)) {
    return "A warm family scene with a child and parent sharing a quiet happy moment together";
  }

  if (/hope|wish|dream|aspir/.test(combined)) {
    return "A child looking at a bright starry sky with a peaceful hopeful expression";
  }

  if (/peace|calm|quiet|serene/.test(combined)) {
    return "A peaceful park scene with a child sitting on a bench watching birds in a tree";
  }

  if (/courage|brave|hero/.test(combined)) {
    return "A child helping a friend who fell down, showing bravery and kindness";
  }

  return "A wholesome everyday scene with a child showing a positive feeling through actions and expressions";
}

function inferSceneFromExample(example) {
  const value = String(example ?? "").toLowerCase();

  if (/work|job|task|study|practice|effort|dedicat/.test(value)) {
    return "A child focused on homework or practicing a skill with quiet determination";
  }

  if (/join|together|group|anyone|people|friend|class|team|us\b/.test(value)) {
    return "Several children together, with one more child joining the group in a friendly classroom scene";
  }

  if (/eat|food|kitchen|restaurant|drink|apple|banana|meal/.test(value)) {
    return "A wholesome food-related everyday scene with clear objects";
  }

  if (/walk|run|park|street|travel|home|school/.test(value)) {
    return "An outdoor or indoor everyday scene with people or nature";
  }

  if (/read|book|study|learn|homework/.test(value)) {
    return "A study scene using objects only, with no readable pages or boards";
  }

  return null;
}

function buildVisualSceneDescription({ definition, example }) {
  const safeDefinition = sanitizeMeaningField(definition, 140);
  const inferredScene = inferSceneFromExample(example);

  if (inferredScene) {
    return inferredScene;
  }

  if (safeDefinition) {
    return `Show this idea visually: ${safeDefinition}`;
  }

  return "A simple everyday scene with clear objects or actions";
}

function buildImagePrompt({ definition, example }) {
  return buildVisualImagePrompt([
    buildVisualSceneDescription({ definition, example }),
    "Depict people, objects, actions, facial expressions, and scenery only.",
    "Keep the scene educational and appropriate for children.",
  ]);
}

function buildExampleFocusedPrompt(example) {
  const inferredScene = inferSceneFromExample(example);

  if (!inferredScene) {
    return "";
  }

  return buildVisualImagePrompt([
    inferredScene,
    "Focus on the action and setting only.",
  ]);
}

function buildGenericPrompt(definition) {
  const safeDefinition = sanitizeMeaningField(definition, 120);
  const scene = safeDefinition
    ? `Show this idea visually: ${safeDefinition}`
    : "A simple wholesome everyday scene with one clear subject";

  return buildVisualImagePrompt([
    scene,
    "Use everyday objects or nature elements only.",
  ]);
}

function buildUltraMinimalNoTextPrompt(definition) {
  const safeDefinition = sanitizeMeaningField(definition, 100);
  const scene = safeDefinition
    ? `One simple subject illustrating: ${safeDefinition}`
    : "One simple wholesome object or action";

  return buildVisualImagePrompt([
    scene,
    "Plain background, minimal detail, no props that usually contain writing.",
  ]);
}

function buildPolicySafePrompt({ term, definition, example, translation }) {
  const safeScene = inferSafeSceneFromMeaning({ term, definition, example, translation });

  return buildVisualImagePrompt([
    safeScene,
    "Use everyday settings only, with no religious symbols, rituals, or places of worship.",
    "Show the feeling through actions, expressions, and objects only.",
  ]);
}

function buildAbstractSafePrompt() {
  return buildVisualImagePrompt([
    "A simple wholesome cartoon scene with one child and one clear positive emotion shown through facial expression and body language.",
    "Everyday setting only, with no religious symbols or props that usually contain writing.",
  ]);
}

function buildUniversalFallbackPrompt() {
  return buildVisualImagePrompt([
    "A bright friendly cartoon illustration of a child in a sunny park with trees, flowers, and a blue sky.",
    "Simple composition, minimal detail, no symbols or props that usually contain writing.",
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

  if (needsPolicySafeFallbacks({ term, definition, example, translation })) {
    add(buildPolicySafePrompt({ term, definition, example, translation }));
  }

  add(buildImagePrompt({ definition, example }));

  const examplePrompt = example ? buildExampleFocusedPrompt(example) : "";

  if (examplePrompt) {
    add(examplePrompt);
  }

  add(buildGenericPrompt(definition));
  add(buildUltraMinimalNoTextPrompt(definition));
  add(buildAbstractSafePrompt());
  add(buildUniversalFallbackPrompt());

  return variants;
}

function isContentPolicyError(message) {
  return /無法生成該內容|无法生成该内容|请调整提示词|請調整提示詞|content.?policy|safety|moderation|inappropriate|not.?allowed|violat/i.test(
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
  const primaryModel = modelAttempts[0];
  const fallbackModel = modelAttempts.at(-1) ?? primaryModel;
  const plan = [];
  const seen = new Set();

  function addStep(prompt, model, size, checkText = true) {
    const key = `${prompt}:${model}:${size}`;

    if (!prompt || seen.has(key)) {
      return;
    }

    seen.add(key);
    plan.push({ prompt, model, size, checkText });
  }

  const policySafe = promptVariants[0];
  const universal = promptVariants.at(-1);
  const abstractSafe = promptVariants.at(-2);

  // Try the safest prompts on both models early so low AGNES_IMAGE_MAX_ATTEMPTS
  // budgets still reach the generic fallbacks.
  addStep(policySafe, primaryModel.model, primaryModel.size);
  addStep(universal, fallbackModel.model, fallbackModel.size, false);
  addStep(abstractSafe, fallbackModel.model, fallbackModel.size, false);
  addStep(universal, primaryModel.model, primaryModel.size, false);

  for (const prompt of promptVariants.slice(1, -2)) {
    addStep(prompt, primaryModel.model, primaryModel.size);
  }

  addStep(abstractSafe, primaryModel.model, primaryModel.size, false);

  return plan;
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
  const policySafe = needsPolicySafeFallbacks({ term, ...meaning });
  const blockedTerms = policySafe
    ? [meaning.translation].filter(Boolean)
    : [term, meaning.translation, meaning.definition].filter(Boolean);
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
  buildAbstractSafePrompt,
  buildExampleFocusedPrompt,
  buildGenericPrompt,
  buildGenerationPlan,
  buildImagePrompt,
  buildImagePromptVariants,
  buildPolicySafePrompt,
  buildUltraMinimalNoTextPrompt,
  buildUniversalFallbackPrompt,
  containsPolicySensitiveMeaning,
  inferSafeSceneFromMeaning,
  needsPolicySafeFallbacks,
};
