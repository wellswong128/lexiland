export const VOCABULARY_LOCALE_LABELS = {
  "zh-Hant": "Traditional Chinese",
  "zh-Hans": "Simplified Chinese",
};

const CJK_PATTERN = /[\u3400-\u9FFF\uF900-\uFAFF]/;

/**
 * UI locale (en / zh-Hant / zh-Hans) controls app chrome.
 * Vocabulary translation fields should always use Chinese, even when the UI is English.
 */
export function resolveVocabularyLocale(uiLocale) {
  if (uiLocale === "zh-Hans") {
    return "zh-Hans";
  }

  return "zh-Hant";
}

export function getVocabularyLocaleLabel(vocabularyLocale) {
  return (
    VOCABULARY_LOCALE_LABELS[vocabularyLocale] ||
    VOCABULARY_LOCALE_LABELS["zh-Hant"]
  );
}

export function containsChinese(text) {
  return CJK_PATTERN.test(String(text ?? "").trim());
}

export function looksLikeEnglishText(text) {
  const value = String(text ?? "").trim();

  if (!value || containsChinese(value)) {
    return false;
  }

  return /[a-zA-Z]/.test(value);
}

const EXAM_COMMAND_PREFIXES = {
  analyse: ["分析"],
  analyze: ["分析"],
  assess: ["評估", "評價"],
  compare: ["比較"],
  describe: ["描述", "描寫"],
  discuss: ["討論", "議論"],
  evaluate: ["評估", "評價"],
  explain: ["解釋", "說明"],
  identify: ["指出", "識別", "辨識"],
  justify: ["論證", "證明"],
};

export function isExamPhraseTerm(term) {
  const parts = String(term ?? "")
    .trim()
    .split(/\s+/);
  return parts.length >= 2 && Object.hasOwn(EXAM_COMMAND_PREFIXES, parts[0].toLowerCase());
}

const PROGRAMMING_EVALUATE_HINTS = [
  "algorithm",
  "code",
  "database",
  "expression",
  "formula",
  "function",
  "interface",
  "network",
  "program",
  "query",
  "spreadsheet",
  "sql",
  "website",
];

function isProgrammingEvaluatePhrase(term) {
  const lower = String(term ?? "").toLowerCase();
  return PROGRAMMING_EVALUATE_HINTS.some((hint) => lower.includes(hint));
}

function isVerbOnlySynonymTranslation(value, prefixes) {
  const chunks = String(value ?? "")
    .split(/[；;/、,，]/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (chunks.length === 0) {
    return true;
  }

  return chunks.every((chunk) => prefixes.includes(chunk));
}

/** Multi-word exam phrases translated with only the command verb, e.g. evaluate X -> 評估 */
export function isIncompleteExamPhraseTranslation(term, translation) {
  const parts = String(term ?? "")
    .trim()
    .split(/\s+/);

  if (parts.length < 2) {
    return false;
  }

  const command = parts[0].toLowerCase();
  const prefixes = EXAM_COMMAND_PREFIXES[command];
  if (!prefixes) {
    return false;
  }

  if (command === "evaluate" && isProgrammingEvaluatePhrase(term)) {
    return false;
  }

  const value = String(translation ?? "").trim();
  if (!value || hasPlaceholderTranslation(value)) {
    return true;
  }

  if (/[；;/]/.test(value)) {
    const chunks = value
      .split(/[；;/]/u)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    if (chunks.length > 0 && chunks.every((chunk) => chunk.length <= 3)) {
      return true;
    }
  }

  if (prefixes.includes(value) || isVerbOnlySynonymTranslation(value, prefixes)) {
    return true;
  }

  if (prefixes.some((prefix) => value.startsWith(prefix))) {
    return false;
  }

  if (prefixes.some((prefix) => value.includes(prefix))) {
    return false;
  }

  return true;
}

/** Placeholder or incomplete AI translations such as "評估 *". */
export function hasPlaceholderTranslation(text) {
  const value = String(text ?? "").trim();

  if (!value) {
    return true;
  }

  if (/[*＊]/.test(value)) {
    return true;
  }

  if (/\bTBD\b/i.test(value)) {
    return true;
  }

  return false;
}

export function hasValidChineseTranslationFields(suggestion, term = "") {
  const translation = String(suggestion?.translation ?? "").trim();

  if (
    !containsChinese(translation) ||
    hasPlaceholderTranslation(translation) ||
    isIncompleteExamPhraseTranslation(term, translation)
  ) {
    return false;
  }

  const exampleTranslation = String(suggestion?.exampleTranslation ?? "").trim();

  if (!exampleTranslation) {
    return true;
  }

  return (
    containsChinese(exampleTranslation) &&
    !hasPlaceholderTranslation(exampleTranslation)
  );
}

export function pickChineseText(suggestionValue, existingValue, term = "") {
  const suggestion = String(suggestionValue ?? "").trim();
  const existing = String(existingValue ?? "").trim();

  const suggestionOk =
    suggestion &&
    containsChinese(suggestion) &&
    !isIncompleteExamPhraseTranslation(term, suggestion);
  const existingOk =
    existing &&
    containsChinese(existing) &&
    !isIncompleteExamPhraseTranslation(term, existing);

  if (suggestionOk) {
    return suggestion;
  }

  if (existingOk) {
    return existing;
  }

  return suggestion || existing;
}
