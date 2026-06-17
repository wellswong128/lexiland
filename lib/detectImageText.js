const AGNES_CHAT_API_URL = "https://apihub.agnes-ai.com/v1/chat/completions";
const DEFAULT_VISION_MODEL = "agnes-2.0-flash";

function parseVisionJson(data) {
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("Vision response did not include text output.");
  }

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fencedMatch ? fencedMatch[1].trim() : text.trim();

  return JSON.parse(jsonText);
}

export async function imageContainsReadableText({ apiKey, imageUrl, model = process.env.AGNES_MODEL || DEFAULT_VISION_MODEL }) {
  const aiResponse = await fetch(AGNES_CHAT_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You inspect illustrations for readable text. Return only valid JSON with a boolean field named hasReadableText.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Does this image contain ANY visible text, letters, numbers, words, captions, labels, signs, logos with lettering, speech bubbles with writing, or readable symbols in any language?

Return only valid JSON:
{"hasReadableText":true}
or
{"hasReadableText":false}

Treat even a single letter, digit, or short word anywhere in the image as hasReadableText=true.`,
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      temperature: 0,
    }),
  });

  if (!aiResponse.ok) {
    return false;
  }

  try {
    const data = await aiResponse.json();
    const parsed = parseVisionJson(data);

    return Boolean(parsed.hasReadableText);
  } catch {
    return false;
  }
}
