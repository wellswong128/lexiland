import { jsonrepair } from "jsonrepair";

export function extractAgnesText(data) {
  const text = data?.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("AI response did not include text output.");
  }

  return text;
}

function extractJsonCandidate(text) {
  const trimmed = String(text ?? "").trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const firstBracket = trimmed.indexOf("[");
  let start = -1;

  if (firstBrace === -1) {
    start = firstBracket;
  } else if (firstBracket === -1) {
    start = firstBrace;
  } else {
    start = Math.min(firstBrace, firstBracket);
  }

  if (start === -1) {
    return trimmed;
  }

  return trimmed.slice(start);
}

function normalizeSmartQuotes(text) {
  return text
    .replace(/[\u201c\u201d\u201e\u201f\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201a\u201b\u2032\u2035]/g, "'");
}

export function parseJsonFromAiText(text) {
  const candidate = normalizeSmartQuotes(extractJsonCandidate(text));

  try {
    return JSON.parse(candidate);
  } catch (firstError) {
    try {
      return JSON.parse(jsonrepair(candidate));
    } catch {
      throw firstError;
    }
  }
}

export function parseAgnesJson(data) {
  return parseJsonFromAiText(extractAgnesText(data));
}

export function isAiJsonOutputError(error) {
  if (error instanceof SyntaxError) {
    return true;
  }

  const message = String(error?.message ?? "");
  return (
    message.includes("AI response") ||
    message.includes("Expected ',' or '}'") ||
    message.includes("Unexpected token") ||
    message.includes("JSON") ||
    message.includes("memory tips")
  );
}
