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

export function hasValidChineseTranslationFields(suggestion) {
  if (!containsChinese(suggestion?.translation)) {
    return false;
  }

  const exampleTranslation = String(suggestion?.exampleTranslation ?? "").trim();

  if (!exampleTranslation) {
    return true;
  }

  return containsChinese(exampleTranslation);
}

export function pickChineseText(suggestionValue, existingValue) {
  const suggestion = String(suggestionValue ?? "").trim();
  const existing = String(existingValue ?? "").trim();

  if (suggestion && containsChinese(suggestion)) {
    return suggestion;
  }

  if (existing && containsChinese(existing)) {
    return existing;
  }

  return suggestion || existing;
}
