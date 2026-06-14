const AGNES_IMAGE_API_URL = "https://apihub.agnes-ai.com/v1/images/generations";

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

function buildImagePrompt({ term, definition, translation, partOfSpeech, example }) {
  const meaningParts = [];

  if (definition) {
    meaningParts.push(definition);
  }

  if (translation) {
    meaningParts.push(`Chinese meaning concept: ${translation}`);
  }

  if (example) {
    meaningParts.push(`Scene idea from example: ${example}`);
  }

  const meaningSummary =
    meaningParts.length > 0
      ? meaningParts.join(" ")
      : `a clear visual idea related to the vocabulary concept for "${term}"`;

  const parts = [
    "Pure illustration only.",
    "CRITICAL: The image must contain zero text of any kind.",
    "Do not include words, letters, numbers, captions, titles, subtitles, labels, signs, banners, speech bubbles, book pages with writing, UI text, logos, or watermarks.",
    "Do not render English or Chinese characters anywhere in the image.",
    "Create a bright, kid-friendly cartoon illustration for a secondary school vocabulary memory aid.",
    `Visual concept to illustrate (for meaning only — never write or display the word "${term}" in the image)${partOfSpeech ? ` (${partOfSpeech})` : ""}: ${meaningSummary}.`,
    "Show one simple, clear scene that helps the learner remember the meaning through visuals alone.",
    "Use objects, actions, facial expressions, and environment instead of written language.",
    "Style: colorful cartoon illustration, soft lighting, uncluttered background, positive mood.",
    "Final check: absolutely no readable text or characters in the image.",
  ];

  return parts.join(" ");
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

  try {
    const imageResponse = await fetch(AGNES_IMAGE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.AGNES_IMAGE_MODEL || "agnes-image-2.1-flash",
        prompt,
        size: process.env.AGNES_IMAGE_SIZE || "800x600",
        extra_body: {
          response_format: "url",
        },
      }),
    });

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      sendJson(response, imageResponse.status, {
        error: `Image generation failed: ${errorText}`,
      });
      return;
    }

    const data = await imageResponse.json();
    const imageUrl = data.data?.[0]?.url;

    if (!imageUrl) {
      sendJson(response, 502, {
        error: "Image generation did not return an image URL.",
      });
      return;
    }

    sendJson(response, 200, { imageUrl, prompt });
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
}
