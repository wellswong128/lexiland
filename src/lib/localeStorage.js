export const LOCALE_STORAGE_KEY = "lexiloop.locale.v1";
export const DEFAULT_LOCALE = "zh-Hant";
export const SUPPORTED_LOCALES = ["zh-Hans", "zh-Hant", "en"];

const LEGACY_LOCALE_MAP = {
  zh: "zh-Hant",
};

export function normalizeLocale(locale) {
  if (SUPPORTED_LOCALES.includes(locale)) {
    return locale;
  }

  if (LEGACY_LOCALE_MAP[locale]) {
    return LEGACY_LOCALE_MAP[locale];
  }

  return DEFAULT_LOCALE;
}

export function loadLocale() {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return normalizeLocale(stored);
  } catch {
    // localStorage may be unavailable.
  }

  return DEFAULT_LOCALE;
}

export function saveLocale(locale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, normalizeLocale(locale));
  } catch {
    // localStorage may be unavailable.
  }
}
