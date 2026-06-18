import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ExampleSentence from "../components/ExampleSentence.jsx";
import SpeakButton from "../components/SpeakButton.jsx";
import WordMemoryPanel from "../components/WordMemoryPanel.jsx";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { useWordsContext } from "../features/words/WordsContext.jsx";

const WORDS_PER_PAGE = 50;

function WordListPage() {
  const { t } = useLocale();
  const { deleteWord, words } = useWordsContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const filteredWords = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return words;
    }

    return words.filter((word) => {
      const term = word.term.toLowerCase();
      const definition = word.definition.toLowerCase();
      const translation = (word.translation ?? "").toLowerCase();
      const tags = word.tags.join(" ").toLowerCase();

      return (
        term.includes(normalizedQuery) ||
        definition.includes(normalizedQuery) ||
        translation.includes(normalizedQuery) ||
        tags.includes(normalizedQuery)
      );
    });
  }, [searchQuery, words]);

  const totalPages = Math.max(1, Math.ceil(filteredWords.length / WORDS_PER_PAGE));

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedWords = useMemo(() => {
    const start = (page - 1) * WORDS_PER_PAGE;
    return filteredWords.slice(start, start + WORDS_PER_PAGE);
  }, [filteredWords, page]);

  function handleDelete(word) {
    const shouldDelete = window.confirm(
      t("wordList.deleteConfirm", { term: word.term }),
    );

    if (shouldDelete) {
      deleteWord(word.id);
    }
  }

  return (
    <section className="w-full max-w-4xl rounded-3xl border border-blue-200/70 bg-white/90 p-6 shadow-2xl shadow-blue-950/10 sm:p-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
            {t("wordList.eyebrow")}
          </p>
          <h1 className="text-4xl font-bold text-blue-950 sm:text-5xl">
            {t("wordList.title")}
          </h1>
          <p className="mt-4 text-slate-600">
            {searchQuery.trim()
              ? t("wordList.filteredCount", { count: filteredWords.length })
              : t("wordList.count", { count: words.length })}
          </p>
        </div>

        <Link
          className="inline-flex justify-center rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-800"
          to="/words/new"
        >
          {t("common.addWord")}
        </Link>
      </div>

      {words.length > 0 ? (
        <label className="mb-6 block">
          <span className="text-sm font-semibold text-slate-700">
            {t("wordList.searchLabel")}
          </span>
          <input
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("wordList.searchPlaceholder")}
            value={searchQuery}
          />
        </label>
      ) : null}

      {words.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/70 p-8 text-center">
          <h2 className="text-xl font-bold text-blue-950">
            {t("wordList.emptyTitle")}
          </h2>
          <p className="mt-2 text-slate-600">{t("wordList.emptyDescription")}</p>
        </div>
      ) : filteredWords.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/70 p-8 text-center">
          <h2 className="text-xl font-bold text-blue-950">
            {t("wordList.noMatchesTitle")}
          </h2>
          <p className="mt-2 text-slate-600">
            {t("wordList.noMatchesDescription")}
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-4">
            {paginatedWords.map((word) => (
            <li
              className="rounded-2xl border border-slate-200 bg-white p-5"
              key={word.id}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold text-blue-950">
                      {word.term}
                    </h2>
                    <SpeakButton text={word.term} />
                  </div>
                  {word.translation ? (
                    <p className="review-word-translation mt-2">{word.translation}</p>
                  ) : (
                    <p className="mt-2 text-sm font-semibold text-slate-400">
                      {t("common.translation")}: {t("common.notYet")}
                    </p>
                  )}

                  {word.example ? (
                    <ExampleSentence
                      className="mt-3"
                      example={word.example}
                      exampleTranslation={word.exampleTranslation}
                    />
                  ) : null}

                  <div className="mt-4">
                    <WordMemoryPanel compact={false} word={word} />
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    {word.definition}
                  </p>
                </div>

                {word.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {word.tags.map((tag) => (
                      <span
                        className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700"
                        key={tag}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  className="rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-200"
                  to={`/words/${word.id}`}
                >
                  {t("common.viewDetails")}
                </Link>
                <button
                  className="rounded-full bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100"
                  onClick={() => handleDelete(word)}
                  type="button"
                >
                  {t("common.delete")}
                </button>
              </div>
            </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-slate-600">
                {t("wordList.pageInfo", {
                  page,
                  totalPages,
                  count: paginatedWords.length,
                  total: filteredWords.length,
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                  type="button"
                >
                  {t("wordList.previousPage")}
                </button>
                <button
                  className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((currentPage) => Math.min(totalPages, currentPage + 1))
                  }
                  type="button"
                >
                  {t("wordList.nextPage")}
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

export default WordListPage;
