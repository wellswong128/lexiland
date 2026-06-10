import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { translations } from "../../i18n/translations.js";
import {
  DEFAULT_LOCALE,
  loadLocale,
  normalizeLocale,
  saveLocale,
} from "../../lib/localeStorage.js";

const LocaleContext = createContext(null);

const DATE_LOCALES = {
  "zh-Hans": "zh-CN",
  "zh-Hant": "zh-TW",
  en: "en-US",
};

const DOCUMENT_LANGS = {
  "zh-Hans": "zh-Hans",
  "zh-Hant": "zh-Hant",
  en: "en",
};

function resolvePath(object, path) {
  return path.split(".").reduce((current, key) => current?.[key], object);
}

function interpolate(template, values = {}) {
  if (typeof template !== "string") {
    return template;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    values[key] === undefined || values[key] === null ? "" : String(values[key]),
  );
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(loadLocale);

  const setLocale = useCallback((nextLocale) => {
    const normalizedLocale = normalizeLocale(nextLocale);
    setLocaleState(normalizedLocale);
    saveLocale(normalizedLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = DOCUMENT_LANGS[locale] ?? "en";
  }, [locale]);

  const t = useCallback(
    (key, values) => {
      const localized =
        resolvePath(translations[locale], key) ??
        resolvePath(translations[DEFAULT_LOCALE], key) ??
        resolvePath(translations.en, key) ??
        key;

      return interpolate(localized, values);
    },
    [locale],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      dateLocale: DATE_LOCALES[locale] ?? "en-US",
    }),
    [locale, setLocale, t],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);

  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider.");
  }

  return context;
}
