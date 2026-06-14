import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SpeakButton from "../components/SpeakButton.jsx";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { useWordsContext } from "../features/words/WordsContext.jsx";

function getTagCounts(words) {
  const tagCounts = new Map();

  for (const word of words) {
    for (const tag of word.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  return [...tagCounts.entries()].sort(([leftTag], [rightTag]) =>
    leftTag.localeCompare(rightTag),
  );
}

function WordListPage() {
  const { t } = useLocale();
  const { deleteWord, words } = useWordsContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState(null);

  const tagCounts = useMemo(() => getTagCounts(words), [words]);

  const filteredWords = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return words.filter((word) => {
      if (selectedTag && !word.tags.includes(selectedTag)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

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
  }, [searchQuery, selectedTag, words]);

  function handleDelete(word) {
    const shouldDelete = window.confirm(
      t("wordList.deleteConfirm", { term: word.term }),
    );

    if (shouldDelete) {
      deleteWord(word.id);
    }
  }

  function toggleTagFilter(tag) {
    setSelectedTag((currentTag) => (currentTag === tag ? null : tag));
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
            {selectedTag || searchQuery.trim()
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
        <>
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

          {tagCounts.length > 0 ? (
            <div className="mb-6">
              <span className="text-sm font-semibold text-slate-700">
                {t("wordList.filterByTag")}
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  className={[
                    "rounded-full px-3 py-1.5 text-xs font-bold transition",
                    selectedTag === null
                      ? "bg-blue-700 text-white shadow-sm"
                      : "bg-blue-100 text-blue-700 hover:bg-blue-200",
                  ].join(" ")}
                  onClick={() => setSelectedTag(null)}
                  type="button"
                >
                  {t("wordList.allTags")} ({words.length})
                </button>
                {tagCounts.map(([tag, count]) => {
                  const isActive = selectedTag === tag;

                  return (
                    <button
                      aria-pressed={isActive}
                      className={[
                        "rounded-full px-3 py-1.5 text-xs font-bold transition",
                        isActive
                          ? "bg-blue-700 text-white shadow-sm"
                          : "bg-blue-100 text-blue-700 hover:bg-blue-200",
                      ].join(" ")}
                      key={tag}
                      onClick={() => toggleTagFilter(tag)}
                      type="button"
                    >
                      {tag} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
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
            {selectedTag
              ? t("wordList.noMatchesTag", { tag: selectedTag })
              : t("wordList.noMatchesDescription")}
          </p>
          {selectedTag ? (
            <button
              className="mt-4 rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-200"
              onClick={() => setSelectedTag(null)}
              type="button"
            >
              {t("wordList.clearTagFilter")}
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-4">
          {filteredWords.map((word) => (
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
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    {word.definition}
                  </p>
                </div>

                {word.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {word.tags.map((tag) => {
                      const isActive = selectedTag === tag;

                      return (
                        <button
                          aria-pressed={isActive}
                          className={[
                            "rounded-full px-3 py-1 text-xs font-bold transition",
                            isActive
                              ? "bg-blue-700 text-white shadow-sm"
                              : "bg-blue-100 text-blue-700 hover:bg-blue-200",
                          ].join(" ")}
                          key={tag}
                          onClick={() => toggleTagFilter(tag)}
                          type="button"
                        >
                          {tag}
                        </button>
                      );
                    })}
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
      )}
    </section>
  );
}

export default WordListPage;
