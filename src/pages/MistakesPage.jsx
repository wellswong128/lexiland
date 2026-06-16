import { Link, useLocation } from "react-router-dom";
import ReviewWordListItem from "../components/ReviewWordListItem.jsx";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { useWordsContext } from "../features/words/WordsContext.jsx";

function MistakesPage() {
  const location = useLocation();
  const { dateLocale, t } = useLocale();
  const { updateWord, words } = useWordsContext();
  const mistakeWords = words.filter((word) => word.mistake.isMistake);

  function formatDate(value) {
    if (!value) {
      return t("common.notYet");
    }

    return new Date(value).toLocaleString(dateLocale);
  }

  function handleClearMistake(word) {
    updateWord(word.id, {
      mistake: {
        ...word.mistake,
        isMistake: false,
        lastMistakeAt: null,
      },
    });
  }

  return (
    <section className="w-full max-w-4xl rounded-3xl border border-blue-200/70 bg-white/90 p-6 shadow-2xl shadow-blue-950/10 sm:p-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
            {t("mistakes.eyebrow")}
          </p>
          <h1 className="text-4xl font-bold text-blue-950 sm:text-5xl">
            {t("mistakes.title")}
          </h1>
          <p className="mt-4 text-slate-600">
            {t("mistakes.count", { count: mistakeWords.length })}
          </p>
        </div>

        <Link
          className="inline-flex justify-center rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-800"
          to="/review/flashcards?mode=mistakes"
        >
          {t("mistakes.reviewMistakes")}
        </Link>
      </div>

      {mistakeWords.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/70 p-8 text-center">
          <h2 className="text-xl font-bold text-blue-950">
            {t("mistakes.emptyTitle")}
          </h2>
          <p className="mt-2 text-slate-600">{t("mistakes.emptyDescription")}</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {mistakeWords.map((word) => (
            <ReviewWordListItem
              actions={
                <>
                  <Link
                    className="rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-200"
                    to={`/words/${word.id}`}
                    state={{ from: location.pathname }}
                  >
                    {t("common.details")}
                  </Link>
                  <button
                    className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
                    onClick={() => handleClearMistake(word)}
                    type="button"
                  >
                    {t("mistakes.clearMistake")}
                  </button>
                </>
              }
              footer={
                <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-bold text-slate-500">
                      {t("mistakes.incorrectCount")}
                    </dt>
                    <dd className="mt-1 text-slate-700">
                      {word.review.incorrectCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-bold text-slate-500">
                      {t("mistakes.lastMistake")}
                    </dt>
                    <dd className="mt-1 text-slate-700">
                      {formatDate(word.mistake.lastMistakeAt)}
                    </dd>
                  </div>
                </dl>
              }
              key={word.id}
              memoryPanelCompact={false}
              showMemoryPanel
              t={t}
              word={word}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export default MistakesPage;
