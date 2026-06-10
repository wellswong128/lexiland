import { useEffect, useRef, useState } from "react";
import { useLocale } from "../features/locale/LocaleContext.jsx";

const LOCALE_OPTIONS = [
  { id: "zh-Hans", label: "簡體" },
  { id: "zh-Hant", label: "繁體" },
  { id: "en", label: "英文" },
];

function getCurrentLabel(locale) {
  return LOCALE_OPTIONS.find((option) => option.id === locale)?.label ?? "繁體";
}

function GlobeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.8 3.1 2.8 14.9 0 18" />
      <path d="M12 3c-2.8 3.1-2.8 14.9 0 18" />
    </svg>
  );
}

function LanguageToggle({ className = "", showInlineOptions = false }) {
  const { locale, setLocale, t } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const currentLabel = getCurrentLabel(locale);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  if (showInlineOptions) {
    return (
      <div
        aria-label={t("language.toggleLabel")}
        className={[
          "inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-blue-200 bg-white/90 p-1 shadow-sm",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        role="group"
      >
        <span className="inline-flex size-9 items-center justify-center text-blue-700">
          <GlobeIcon />
        </span>
        {LOCALE_OPTIONS.map((option) => (
          <button
            aria-pressed={locale === option.id}
            className={[
              "min-h-9 rounded-full px-3 text-sm font-bold transition",
              locale === option.id
                ? "bg-blue-700 text-white shadow-sm"
                : "text-slate-600 hover:bg-blue-50",
            ].join(" ")}
            key={option.id}
            onClick={() => setLocale(option.id)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={["relative", className].filter(Boolean).join(" ")} ref={rootRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={t("language.toggleLabel")}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-blue-200 bg-white px-3 text-blue-700 shadow-sm transition hover:bg-blue-50"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <GlobeIcon />
        <span className="text-xs font-bold">{currentLabel}</span>
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[100] min-w-[8.5rem] overflow-hidden rounded-2xl border border-blue-100 bg-white py-1 shadow-xl shadow-blue-950/20"
          role="listbox"
        >
          {LOCALE_OPTIONS.map((option) => {
            const isActive = locale === option.id;

            return (
              <button
                aria-selected={isActive}
                className={[
                  "flex w-full items-center justify-between px-4 py-2.5 text-sm font-bold transition",
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-700 hover:bg-slate-50",
                ].join(" ")}
                key={option.id}
                onClick={() => {
                  setLocale(option.id);
                  setIsOpen(false);
                }}
                role="option"
                type="button"
              >
                <span>{option.label}</span>
                {isActive ? <span aria-hidden="true">✓</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default LanguageToggle;
