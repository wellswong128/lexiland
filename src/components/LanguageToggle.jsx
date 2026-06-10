import { useLocale } from "../features/locale/LocaleContext.jsx";

function LanguageToggle({ className = "" }) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      aria-label={t("language.toggleLabel")}
      className={["inline-flex rounded-full border border-blue-200 bg-white p-0.5", className]
        .filter(Boolean)
        .join(" ")}
      role="group"
    >
      <button
        aria-pressed={locale === "zh"}
        className={[
          "min-h-9 rounded-full px-3 text-xs font-bold transition",
          locale === "zh"
            ? "bg-blue-700 text-white shadow-sm"
            : "text-slate-600 hover:bg-blue-50",
        ].join(" ")}
        onClick={() => setLocale("zh")}
        type="button"
      >
        中
      </button>
      <button
        aria-pressed={locale === "en"}
        className={[
          "min-h-9 rounded-full px-3 text-xs font-bold transition",
          locale === "en"
            ? "bg-blue-700 text-white shadow-sm"
            : "text-slate-600 hover:bg-blue-50",
        ].join(" ")}
        onClick={() => setLocale("en")}
        type="button"
      >
        EN
      </button>
    </div>
  );
}

export default LanguageToggle;
