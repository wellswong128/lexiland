export const NO_TEXT_NEGATIVE_PROMPT = [
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
  "dialogue bubble",
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
  "strict rule",
  "top priority",
  "final check",
  "remember",
  "vocabulary",
  "flashcard text",
  "headline",
  "title card",
].join(", ");

export function buildVisualImagePrompt(visualLines) {
  const lines = Array.isArray(visualLines) ? visualLines : [visualLines];

  return [
    "Wholesome cartoon illustration for children, picture-book style.",
    ...lines.filter(Boolean),
    "Bright soft colors, simple clean background.",
  ].join(" ");
}

export function buildNegativePrompt(extraTerms = []) {
  const blockedTerms = extraTerms
    .flatMap((value) => String(value ?? "").split(/[\s;；,，/|]+/))
    .map((value) => value.trim())
    .filter(Boolean);

  const uniqueBlockedTerms = [...new Set(blockedTerms)];

  if (uniqueBlockedTerms.length === 0) {
    return `${NO_TEXT_NEGATIVE_PROMPT}, readable, subtitle, lettering, wordmark`;
  }

  return `${NO_TEXT_NEGATIVE_PROMPT}, readable, subtitle, lettering, wordmark, ${uniqueBlockedTerms.join(", ")}`;
}
