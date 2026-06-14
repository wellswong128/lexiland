import { useEffect, useState } from "react";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import {
  fetchWordImageWithCache,
  readCachedWordImage,
} from "../features/words/wordImageApi.js";

function WordImagePanel({ compact = false, word }) {
  const { t } = useLocale();
  const [image, setImage] = useState(() => readCachedWordImage(word));
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("success");

  useEffect(() => {
    setImage(readCachedWordImage(word));
    setIsExpanded(!compact);
    setNotice("");
    setNoticeType("success");
  }, [compact, word.id, word.updatedAt]);

  async function handleGenerate({ forceRefresh = false } = {}) {
    try {
      setIsLoading(true);
      setNotice("");

      const result = await fetchWordImageWithCache(word, { forceRefresh });

      setImage(result);
      setIsExpanded(true);
      setNotice(
        result.fromCache ? t("wordImage.fromCache") : t("wordImage.success"),
      );
      setNoticeType("success");
    } catch (error) {
      setNotice(error.message);
      setNoticeType("error");
    } finally {
      setIsLoading(false);
    }
  }

  if (!word) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-sky-200/80 bg-sky-50/70 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-sky-950">{t("wordImage.title")}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {t("wordImage.description")}
          </p>
        </div>
        <button
          className="inline-flex shrink-0 justify-center rounded-full bg-sky-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-sky-800 disabled:bg-slate-300"
          disabled={isLoading}
          onClick={() => handleGenerate({ forceRefresh: Boolean(image) })}
          type="button"
        >
          {isLoading
            ? t("wordImage.loading")
            : image
              ? t("wordImage.refresh")
              : t("wordImage.generate")}
        </button>
      </div>

      {notice ? (
        <p
          className={[
            "mt-3 rounded-xl px-3 py-2 text-sm font-medium",
            noticeType === "success"
              ? "border border-green-200 bg-green-50 text-green-700"
              : "border border-red-200 bg-red-50 text-red-700",
          ].join(" ")}
        >
          {notice}
        </p>
      ) : null}

      {image?.imageUrl ? (
        <div className="mt-4 space-y-3">
          {compact ? (
            <button
              className="text-sm font-bold text-sky-700 transition hover:text-sky-900"
              onClick={() => setIsExpanded((current) => !current)}
              type="button"
            >
              {isExpanded ? t("wordImage.hide") : t("wordImage.show")}
            </button>
          ) : null}

          {isExpanded ? (
            <figure className="overflow-hidden rounded-2xl border border-sky-100 bg-white">
              <img
                alt={t("wordImage.alt", { term: word.term })}
                className="h-auto w-full object-cover"
                loading="lazy"
                src={image.imageUrl}
              />
            </figure>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default WordImagePanel;
