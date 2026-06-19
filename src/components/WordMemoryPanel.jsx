import { useEffect, useState } from "react";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { getQuizOptionLabel } from "../features/review/quizHelpers.js";
import { useWordsContext } from "../features/words/WordsContext.jsx";
import {
  fetchWordMemoryWithCache,
  readWordMemory,
} from "../features/words/wordMemoryApi.js";
import WordImageWithTranslationOverlay from "./WordImageWithTranslationOverlay.jsx";

function WordMemoryPanel({
  autoLoad = false,
  compact = false,
  showTranslationOverlay = false,
  word,
}) {
  const { locale, t } = useLocale();
  const { updateWord, user } = useWordsContext();
  const [memoryTips, setMemoryTips] = useState(
    () => readWordMemory(word, locale).memoryTips,
  );
  const [memoryImage, setMemoryImage] = useState(
    () => readWordMemory(word, locale).memoryImage,
  );
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("success");

  useEffect(() => {
    const saved = readWordMemory(word, locale);
    setMemoryTips(saved.memoryTips);
    setMemoryImage(saved.memoryImage);
    setIsExpanded(!compact);
    setNotice("");
    setNoticeType("success");
  }, [compact, locale, word.id, word.memoryImage, word.memoryTipsByLocale, word.updatedAt]);

  async function handleGenerate({ forceRefresh = false } = {}) {
    try {
      setIsLoading(true);
      setNotice("");

      const result = await fetchWordMemoryWithCache(word, locale, {
        forceRefresh,
        user,
      });

      if (result.changes) {
        await updateWord(word.id, result.changes);
      }

      setMemoryTips(result.memoryTips);
      setMemoryImage(result.memoryImage);
      setIsExpanded(true);

      if (result.usedFallback) {
        setNotice(t("memoryTips.fallback", { reason: result.fallbackReason }));
        setNoticeType("warning");
      } else if (result.imageError) {
        setNotice(t("wordMemory.imageFailed", { reason: result.imageError }));
        setNoticeType("warning");
      } else if (result.fromCache) {
        setNotice(t("wordMemory.fromCache"));
        setNoticeType("success");
      } else {
        setNotice(t("wordMemory.success"));
        setNoticeType("success");
      }
    } catch (error) {
      setNotice(error.message);
      setNoticeType("error");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!autoLoad) {
      return;
    }

    const saved = readWordMemory(word, locale);
    const hasAnyMemory = Boolean(saved.memoryTips || saved.memoryImage?.imageUrl);

    if (hasAnyMemory) {
      return;
    }

    void handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, locale, word.id, word.memoryImage, word.memoryTipsByLocale]);

  if (!word) {
    return null;
  }

  const hasContent = Boolean(memoryTips || memoryImage?.imageUrl);

  return (
    <section className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-sky-50/80 via-white to-violet-50/80 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-indigo-950">{t("wordMemory.title")}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {t("wordMemory.description")}
          </p>
        </div>
        <button
          className="inline-flex shrink-0 justify-center rounded-full bg-indigo-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-800 disabled:bg-slate-300"
          disabled={isLoading}
          onClick={() => handleGenerate({ forceRefresh: true })}
          type="button"
        >
          {isLoading
            ? t("wordMemory.loading")
            : t(hasContent ? "wordMemory.refresh" : "wordMemory.generate")}
        </button>
      </div>

      {notice ? (
        <p
          className={[
            "mt-3 rounded-xl px-3 py-2 text-sm font-medium",
            noticeType === "success"
              ? "border border-green-200 bg-green-50 text-green-700"
              : noticeType === "warning"
                ? "border border-amber-200 bg-amber-50 text-amber-800"
                : "border border-red-200 bg-red-50 text-red-700",
          ].join(" ")}
        >
          {notice}
        </p>
      ) : null}

      {hasContent ? (
        <div className="mt-4 space-y-4">
          {compact ? (
            <button
              className="text-sm font-bold text-indigo-700 transition hover:text-indigo-900"
              onClick={() => setIsExpanded((current) => !current)}
              type="button"
            >
              {isExpanded ? t("wordMemory.hide") : t("wordMemory.show")}
            </button>
          ) : null}

          {isExpanded ? (
            <>
              {memoryImage?.imageUrl ? (
                showTranslationOverlay ? (
                  <WordImageWithTranslationOverlay
                    alt={t("wordImage.alt", { term: word.term })}
                    className="relative overflow-hidden rounded-2xl border border-sky-100 bg-white"
                    imageClassName="mx-auto h-auto max-h-[600px] w-full max-w-[800px] object-contain"
                    src={memoryImage.imageUrl}
                    translation={getQuizOptionLabel(word)}
                  />
                ) : (
                  <figure className="overflow-hidden rounded-2xl border border-sky-100 bg-white">
                    <img
                      alt={t("wordImage.alt", { term: word.term })}
                      className="mx-auto h-auto max-h-[600px] w-full max-w-[800px] object-contain"
                      loading="lazy"
                      src={memoryImage.imageUrl}
                    />
                  </figure>
                )
              ) : null}

              {memoryTips ? (
                <div className="space-y-3">
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
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default WordMemoryPanel;
