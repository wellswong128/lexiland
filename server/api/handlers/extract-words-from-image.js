import { splitIntoSingleWordTerms } from "../../../lib/normalizeWordTerms.js";
import { requireAiApiAccess, sendAuthError } from "../_authz.js";

const AGNES_API_URL = "https://apihub.agnes-ai.com/v1/chat/completions";
const MAX_IMAGE_CHARS = 4_500_000;

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

function parseAgnesJson(data) {
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("AI response did not include text output.");
  }

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fencedMatch ? fencedMatch[1].trim() : text.trim();

  return JSON.parse(jsonText);
}

function normalizeExtractedWords(words) {
  return splitIntoSingleWordTerms(words).map((term) => ({ term }));
}

// Wordbase filtering at extract time is bulk-import-only (scripts/wordbase_import/).
// Web photo scan returns every detected term; users choose what to save to their list.
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
  const imageDataUrl = String(body.imageDataUrl ?? "").trim();

  if (!imageDataUrl.startsWith("data:image/")) {
    sendJson(response, 400, { error: "Please provide a valid image data URL." });
    return;
  }

  if (imageDataUrl.length > MAX_IMAGE_CHARS) {
    sendJson(response, 400, { error: "Image is too large. Try a smaller photo." });
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
              "You extract English vocabulary words from study images. Return only valid JSON.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Look at this image and list every distinct English vocabulary word a learner might want to save.

Return only valid JSON in this shape:
{"words":["apple","banana"]}

Rules:
- lowercase single words only
- one word per array item (never phrases like "ice cream")
- no duplicates
- exclude numbers and punctuation-only tokens
- skip very common grammar words unless they are clearly vocabulary targets (skip: the, a, an, is, are, was, were, to, of, in, on, at, and, or, but)
- include up to 40 words maximum`,
              },
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl,
                },
              },
            ],
          },
        ],
        temperature: 0.1,
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
    const parsed = parseAgnesJson(data);
    const words = normalizeExtractedWords(parsed.words);

    if (words.length === 0) {
      sendJson(response, 422, {
        error: "No English words were detected in this image.",
      });
      return;
    }

    sendJson(response, 200, { words });
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
}
