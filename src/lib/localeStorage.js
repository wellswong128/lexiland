export const LOCALE_STORAGE_KEY = "lexiloop.locale.v1";
export const DEFAULT_LOCALE = "zh";
export const SUPPORTED_LOCALES = ["zh", "en"];

export function loadLocale() {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (SUPPORTED_LOCALES.includes(stored)) {
      return stored;
    }
  } catch {
    // localStorage may be unavailable.
  }

  return DEFAULT_LOCALE;
}

export function saveLocale(locale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // localStorage may be unavailable.
  }
}
