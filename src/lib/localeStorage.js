export const LOCALE_STORAGE_KEY = "lexiland.locale.v1";
const LEGACY_LOCALE_STORAGE_KEY = "lexiloop.locale.v1";
export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = ["zh-Hans", "zh-Hant", "en"];

const LEGACY_LOCALE_MAP = {
  zh: "zh-Hans",
};

const DEVICE_LOCALE_MAP = {
  "zh-hans": "zh-Hans",
  "zh-cn": "zh-Hans",
  "zh-sg": "zh-Hans",
  "zh-chs": "zh-Hans",
  "zh-hant": "zh-Hant",
  "zh-tw": "zh-Hant",
  "zh-hk": "zh-Hant",
  "zh-mo": "zh-Hant",
  "zh-cht": "zh-Hant",
  en: "en",
};

function migrateLocaleStorageKey() {
  try {
    if (localStorage.getItem(LOCALE_STORAGE_KEY)) {
      return;
    }

    const legacyValue = localStorage.getItem(LEGACY_LOCALE_STORAGE_KEY);

    if (!legacyValue) {
      return;
    }

    localStorage.setItem(LOCALE_STORAGE_KEY, legacyValue);
    localStorage.removeItem(LEGACY_LOCALE_STORAGE_KEY);
  } catch {
    // localStorage may be unavailable.
  }
}

function matchDeviceLocaleTag(tag) {
  const normalized = String(tag ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");

  if (!normalized) {
    return null;
  }

  if (SUPPORTED_LOCALES.includes(tag)) {
    return tag;
  }

  if (DEVICE_LOCALE_MAP[normalized]) {
    return DEVICE_LOCALE_MAP[normalized];
  }

  const [language, region] = normalized.split("-");

  if (region && DEVICE_LOCALE_MAP[`${language}-${region}`]) {
    return DEVICE_LOCALE_MAP[`${language}-${region}`];
  }

  if (language === "en") {
    return "en";
  }

  return null;
}

export function detectDeviceLocale() {
  if (typeof navigator === "undefined") {
    return DEFAULT_LOCALE;
  }

  const candidates = [navigator.language, ...(navigator.languages ?? [])];

  for (const candidate of candidates) {
    const matched = matchDeviceLocaleTag(candidate);

    if (matched) {
      return matched;
    }
  }

  return DEFAULT_LOCALE;
}

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
    migrateLocaleStorageKey();
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);

    if (stored) {
      return normalizeLocale(stored);
    }

    return detectDeviceLocale();
  } catch {
    // localStorage may be unavailable.
  }

  return detectDeviceLocale();
}

export function saveLocale(locale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, normalizeLocale(locale));
  } catch {
    // localStorage may be unavailable.
  }
}
