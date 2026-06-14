import { useEffect, useState } from "react";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { useWordsContext } from "../features/words/WordsContext.jsx";
import {
  fetchMemoryTipsWithFallback,
  readWordMemoryTips,
} from "../features/words/memoryTipsApi.js";

function MemoryTipsPanel({ compact = false, word }) {
  const { locale, t } = useLocale();
  const { updateWord } = useWordsContext();
  const [memoryTips, setMemoryTips] = useState(() => readWordMemoryTips(word, locale));
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    setMemoryTips(readWordMemoryTips(word, locale));
    setIsExpanded(!compact);
    setNotice("");
    setUsedFallback(false);
  }, [compact, locale, word.id, word.memoryTipsByLocale, word.updatedAt]);

  async function handleGenerate({ forceRefresh = false } = {}) {
    try {
      setIsLoading(true);
      setNotice("");

      const result = await fetchMemoryTipsWithFallback(word, locale, {
        forceRefresh,
      });

      if (result.changes) {
        await updateWord(word.id, result.changes);
      }

      setMemoryTips(result.memoryTips);
      setUsedFallback(result.usedFallback);
      setIsExpanded(true);

      if (result.usedFallback) {
        setNotice(t("memoryTips.fallback", { reason: result.fallbackReason }));
      } else if (result.fromCache) {
        setNotice(t("memoryTips.fromCache"));
      } else {
        setNotice(t("memoryTips.success"));
      }
    } catch (error) {
      setNotice(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  if (!word) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-violet-200/80 bg-violet-50/70 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-violet-950">{t("memoryTips.title")}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {t("memoryTips.description")}
          </p>
        </div>
        <button
          className="inline-flex shrink-0 justify-center rounded-full bg-violet-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-800 disabled:bg-slate-300"
          disabled={isLoading}
          onClick={() => handleGenerate({ forceRefresh: Boolean(memoryTips) })}
          type="button"
        >
          {isLoading
            ? t("memoryTips.loading")
            : memoryTips
              ? t("memoryTips.refresh")
              : t("memoryTips.generate")}
        </button>
      </div>

      {notice ? (
        <p
          className={[
            "mt-3 rounded-xl px-3 py-2 text-sm font-medium",
            usedFallback
              ? "border border-amber-200 bg-amber-50 text-amber-800"
              : "border border-green-200 bg-green-50 text-green-700",
          ].join(" ")}
        >
          {notice}
        </p>
      ) : null}

      {memoryTips ? (
        <div className="mt-4 space-y-3">
          {compact ? (
            <button
              className="text-sm font-bold text-violet-700 transition hover:text-violet-900"
              onClick={() => setIsExpanded((current) => !current)}
              type="button"
            >
              {isExpanded ? t("memoryTips.hide") : t("memoryTips.show")}
            </button>
          ) : null}

          {isExpanded ? (
            <>
              {memoryTips.summary ? (
                <p className="rounded-2xl border border-violet-100 bg-white px-4 py-3 text-sm font-semibold leading-7 text-violet-950">
                  {memoryTips.summary}
                </p>
              ) : null}

              <ul className="space-y-3">
                {memoryTips.tips.map((tip) => (
                  <li
                    className="rounded-2xl border border-violet-100 bg-white px-4 py-3"
                    key={`${tip.method}-${tip.content}`}
                  >
                    <p className="text-sm font-bold text-violet-700">{tip.method}</p>
                    <p className="mt-1 text-sm leading-7 text-slate-700">{tip.content}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default MemoryTipsPanel;
