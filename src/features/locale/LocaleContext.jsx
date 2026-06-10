import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { translations } from "../../i18n/translations.js";
import {
  DEFAULT_LOCALE,
  loadLocale,
  saveLocale,
} from "../../lib/localeStorage.js";

const LocaleContext = createContext(null);

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

function getDocumentLang(locale) {
  return locale === "zh" ? "zh-Hant" : "en";
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(loadLocale);

  const setLocale = useCallback((nextLocale) => {
    setLocaleState(nextLocale);
    saveLocale(nextLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = getDocumentLang(locale);
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
      dateLocale: locale === "zh" ? "zh-TW" : "en-US",
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
