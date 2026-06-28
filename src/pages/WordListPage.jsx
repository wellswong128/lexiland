import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ExampleSentence from "../components/ExampleSentence.jsx";
import SpeakButton from "../components/SpeakButton.jsx";
import WordMemoryPanel from "../components/WordMemoryPanel.jsx";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import WordScopeModeSwitch from "../features/wordGroups/WordScopeModeSwitch.jsx";
import { getActiveGroupLabel } from "../features/wordGroups/getActiveGroupLabel.js";
import WordGroupScopeEmptyState from "../features/wordGroups/WordGroupScopeEmptyState.jsx";
import { useActiveGroupWordScope } from "../features/wordGroups/useActiveGroupWordScope.js";
import { useEnsureActiveGroupWords } from "../features/wordGroups/useEnsureActiveGroupWords.js";
import { useWordsContext } from "../features/words/WordsContext.jsx";
import { can, getRoleFromUser, PERMISSIONS } from "../lib/authorization.js";

const WORDS_PER_PAGE = 20;
const HIDDEN_WORD_LIST_TAGS = new Set([
  "hk",
  "primary",
  "secondary",
  "p1",
  "p2",
  "p3",
  "p4",
  "p5",
  "p6",
  "s1",
  "s2",
  "s3",
  "s4",
  "s5",
  "s6",
  "economics",
  "physics",
  "general-studies",
  "biology",
  "mathematics",
  "english",
  "ict",
  "history",
  "integrated-science",
  "science",
  "chinese",
  "chinese-history",
  "geography",
  "chemistry",
]);

function getVisibleWordTags(tags = []) {
  return tags.filter(
    (tag) => !HIDDEN_WORD_LIST_TAGS.has(String(tag ?? "").trim().toLowerCase()),
  );
}

function WordListPage() {
  const { locale, t } = useLocale();
  const { autoImportedNotice, clearAutoImportedNotice, deleteWord, isActiveGroupSyncing, user, words } =
    useWordsContext();
  const {
    isLoadingScope,
    isGroupScopeActive,
    isUsingCustomWords,
    scopedWords,
    activeGroup,
    scopeReason,
    scopeError,
  } = useActiveGroupWordScope(words, user);
  useEnsureActiveGroupWords();
  const role = getRoleFromUser(user);
  const canCreateWord = can(role, PERMISSIONS.WORDS_CREATE);
  const canDeleteWord = can(role, PERMISSIONS.WORDS_DELETE);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [memoryAssistWordIds, setMemoryAssistWordIds] = useState(() => new Set());

  const filteredWords = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const sourceWords = isGroupScopeActive ? scopedWords : words;

    if (!normalizedQuery) {
      return sourceWords;
    }

    return sourceWords.filter((word) => {
      const term = word.term.toLowerCase();
      const definition = word.definition.toLowerCase();
      const translation = (word.translation ?? "").toLowerCase();
      const tags = getVisibleWordTags(word.tags).join(" ").toLowerCase();

      return (
        term.includes(normalizedQuery) ||
        definition.includes(normalizedQuery) ||
        translation.includes(normalizedQuery) ||
        tags.includes(normalizedQuery)
      );
    });
  }, [isGroupScopeActive, scopedWords, searchQuery, words]);

  const totalPages = Math.max(1, Math.ceil(filteredWords.length / WORDS_PER_PAGE));

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (!autoImportedNotice) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      clearAutoImportedNotice();
    }, 8000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autoImportedNotice, clearAutoImportedNotice]);

  const paginatedWords = useMemo(() => {
    const start = (page - 1) * WORDS_PER_PAGE;
    return filteredWords.slice(start, start + WORDS_PER_PAGE);
  }, [filteredWords, page]);

  function showMemoryAssist(wordId) {
    setMemoryAssistWordIds((current) => {
      if (current.has(wordId)) {
        return current;
      }

      const next = new Set(current);
      next.add(wordId);
      return next;
    });
  }

  function hideMemoryAssist(wordId) {
    setMemoryAssistWordIds((current) => {
      if (!current.has(wordId)) {
        return current;
      }

      const next = new Set(current);
      next.delete(wordId);
      return next;
    });
  }

  function handleDelete(word) {
    const shouldDelete = window.confirm(
      t("wordList.deleteConfirm", { term: word.term }),
    );

    if (shouldDelete) {
      deleteWord(word.id);
    }
  }

  function getNoticeGroupLabel() {
    if (!autoImportedNotice) {
      return "";
    }
    if (locale === "en") {
      return (
        autoImportedNotice.groupNameEn ||
        autoImportedNotice.groupNameZhHant ||
        autoImportedNotice.groupCode
      );
    }

    return (
      autoImportedNotice.groupNameZhHant ||
      autoImportedNotice.groupNameEn ||
      autoImportedNotice.groupCode
    );
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
              : t("wordList.count", { count: (isGroupScopeActive ? scopedWords : words).length })}
          </p>
          {isUsingCustomWords ? (
            <p className="mt-2 text-sm font-semibold text-blue-700">
              {t("wordGroupsScope.customWordsLabel")}
            </p>
          ) : isGroupScopeActive && activeGroup ? (
            <p className="mt-2 text-sm font-semibold text-blue-700">
              {t("wordGroupsScope.activeGroupLabel", {
                group: getActiveGroupLabel(activeGroup, locale),
              })}
            </p>
          ) : null}
          <WordScopeModeSwitch className="mt-3" compact />
        </div>

        {canCreateWord ? (
          <Link
            className="inline-flex justify-center rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-800"
            to="/words/new"
          >
            {t("common.addWord")}
          </Link>
        ) : null}
      </div>

      {(isGroupScopeActive ? scopedWords : words).length > 0 ? (
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

      {scopeError ? (
        <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {scopeError}
        </p>
      ) : null}

      {autoImportedNotice ? (
        <p className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          {t("wordList.autoImportedFromGroup", {
            count: autoImportedNotice.count,
            group: getNoticeGroupLabel(),
          })}
        </p>
      ) : null}

      {isLoadingScope ? (
        <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/70 p-8 text-center">
          <p className="text-sm text-slate-600">{t("wordGroupsScope.loading")}</p>
        </div>
      ) : isGroupScopeActive && scopedWords.length === 0 ? (
        <WordGroupScopeEmptyState
          activeGroup={activeGroup}
          isImporting={isActiveGroupSyncing}
          scopeReason={scopeReason}
        />
      ) : words.length === 0 ? (
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
                    {memoryAssistWordIds.has(word.id) ? (
                      <>
                        <WordMemoryPanel autoLoad compact={false} word={word} />
                        <button
                          className="mt-2 text-sm font-bold text-indigo-700 transition hover:text-indigo-900"
                          onClick={() => hideMemoryAssist(word.id)}
                          type="button"
                        >
                          {t("wordMemory.hide")}
                        </button>
                      </>
                    ) : (
                      <button
                        className="text-sm font-bold text-indigo-700 transition hover:text-indigo-900"
                        onClick={() => showMemoryAssist(word.id)}
                        type="button"
                      >
                        {t("wordMemory.show")}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    className="rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-200"
                    to={`/words/${word.id}`}
                  >
                    {t("common.viewDetails")}
                  </Link>
                  {canDeleteWord ? (
                    <button
                      className="rounded-full bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100"
                      onClick={() => handleDelete(word)}
                      type="button"
                    >
                      {t("common.delete")}
                    </button>
                  ) : null}
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
