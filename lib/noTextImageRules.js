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

export const NO_TEXT_PROMPT_PREFIX =
  "TOP PRIORITY — STRICT RULE: Generate a completely text-free illustration. The image must not contain any text, letters, numbers, symbols used as writing, captions, labels, signs, logos, watermarks, speech bubbles, or readable characters in any language.";

export const NO_TEXT_PROMPT_SUFFIX =
  "Remember: absolutely no text anywhere in the image. Pure visual storytelling with objects, actions, scenery, colors, and expressions only.";

export const NO_TEXT_MANDATORY_RULES = [
  "This no-text rule is the highest priority and overrides every other instruction.",
  "Do not write, print, engrave, stitch, paint, or display any characters, words, numbers, or symbols that could be read.",
  "Never render the vocabulary word, its translation, example sentence, or any hint from this prompt as visible text in the image.",
  "All meaning hints below are illustrator guidance only and must never appear as lettering in the picture.",
  "Avoid books, newspapers, screens, signs, blackboards, labels, and any object that usually shows writing.",
].join(" ");

export function wrapNoTextPrompt(bodyLines) {
  const lines = Array.isArray(bodyLines) ? bodyLines : [bodyLines];

  return [
    NO_TEXT_PROMPT_PREFIX,
    NO_TEXT_MANDATORY_RULES,
    ...lines.filter(Boolean),
    NO_TEXT_PROMPT_SUFFIX,
    "Final check: the image must be 100% free of all text and readable symbols.",
  ].join(" ");
}

export function buildNegativePrompt(extraTerms = []) {
  const blockedTerms = extraTerms
    .flatMap((value) => String(value ?? "").split(/\s+/))
    .map((value) => value.trim())
    .filter(Boolean);

  const uniqueBlockedTerms = [...new Set(blockedTerms)];

  if (uniqueBlockedTerms.length === 0) {
    return `${NO_TEXT_NEGATIVE_PROMPT}, readable, subtitle, lettering, wordmark`;
  }

  return `${NO_TEXT_NEGATIVE_PROMPT}, readable, subtitle, lettering, wordmark, ${uniqueBlockedTerms.join(", ")}`;
}
