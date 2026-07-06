import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import ExampleSentence from "../components/ExampleSentence.jsx";
import SpeakButton from "../components/SpeakButton.jsx";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import {
  fetchCompleteWordWithFallback,
  suggestionToFormValues,
} from "../features/words/completeWordApi.js";
import { findWordInLibrary } from "../features/review/gameMistakeHelpers.js";
import { hasMemoryImageUrl } from "../features/words/memoryImageUtils.js";
import { contributeWordDetailsFromSuggestion } from "../features/words/wordbaseApi.js";
import { WORD_SOURCES } from "../features/words/wordTypes.js";
import { useWordsContext } from "../features/words/WordsContext.jsx";

function LookupSourceBadge({ sourceKey, t }) {
  return (
    <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
      {t(sourceKey)}
    </span>
  );
}

function WordLookupPage() {
  const { locale, t } = useLocale();
  const location = useLocation();
  const { addWord, hasSupabaseConfig, isUsingSupabase, user, words } = useWordsContext();
  const [term, setTerm] = useState("");
  const [error, setError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function getSourceKey(result) {
    if (result.fromLocal) {
      return "wordLookup.sourceLocal";
    }

    return "wordLookup.sourceAi";
  }

  function handleClearTerm() {
    setTerm("");
    setError("");
    setSaveMessage("");
    setLookupResult(null);
    inputRef.current?.focus();
  }

  async function handleSearch(event) {
    event?.preventDefault();

    const normalizedTerm = term.trim();

    if (!normalizedTerm) {
      setError(t("wordLookup.enterTerm"));
      setLookupResult(null);
      return;
    }

    try {
      setError("");
      setSaveMessage("");
      setIsSearching(true);

      const result = await fetchCompleteWordWithFallback(normalizedTerm, locale, {
        user,
        localWords: words,
      });
      const localWord = findWordInLibrary(words, normalizedTerm);

      setLookupResult({
        ...result,
        suggestion: result.suggestion,
        values: suggestionToFormValues(result.suggestion),
        localWordId: localWord?.id ?? null,
      });
    } catch (searchError) {
      setLookupResult(null);
      setError(searchError.message);
    } finally {
      setIsSearching(false);
    }
  }

  function handleTermKeyDown(event) {
    if (event.key !== "Enter" || isSearching || isSaving) {
      return;
    }

    event.preventDefault();
    handleSearch();
  }

  function canAddToWordList(result) {
    if (!result || result.localWordId || result.usedFallback) {
      return false;
    }

    if (!result.values?.term?.trim() || !result.values?.definition?.trim()) {
      return false;
    }

    return result.fromWordbase || (!result.fromLocal && !result.fromWordbase);
  }

  function buildWordListInput(result) {
    return {
      ...result.values,
      memoryImage: result.memoryImage ?? null,
      memoryTipsByLocale: result.memoryTipsByLocale ?? {},
    };
  }

  function resolveWordSource(result) {
    if (result.fromWordbase) {
      return WORD_SOURCES.IMPORT;
    }

    return WORD_SOURCES.AI;
  }

  async function handleAddToWordList() {
    if (!lookupResult || !canAddToWordList(lookupResult)) {
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      const savedWord = await addWord(buildWordListInput(lookupResult), {
        source: resolveWordSource(lookupResult),
      });

      if (isAiSource(lookupResult) && lookupResult.suggestion && user?.id) {
        try {
          await contributeWordDetailsFromSuggestion(lookupResult.suggestion, user.id);
        } catch (syncError) {
          console.warn("Could not contribute word details to wordbase.", syncError);
        }
      }

      setSaveMessage(t("wordLookup.addSuccess"));
      setLookupResult((currentResult) =>
        currentResult
          ? {
              ...currentResult,
              fromLocal: true,
              localWordId: savedWord.id,
            }
          : currentResult,
      );
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  }

  function isAiSource(result) {
    return Boolean(result && !result.fromLocal && !result.fromWordbase && !result.usedFallback);
  }

  const loginRedirect = `/auth?mode=login&redirect=${encodeURIComponent(
    `${location.pathname}${location.search}`,
  )}`;
  const showGuestLocalHint =
    canAddToWordList(lookupResult) && hasSupabaseConfig && !user?.id && !isUsingSupabase;
  const resultValues = lookupResult?.values;

  return (
    <section className="w-full max-w-[430px] rounded-3xl border border-blue-200/70 bg-white/90 p-5 shadow-2xl shadow-blue-950/10 sm:p-8">
      <div className="mb-6 text-center">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
          {t("wordLookup.eyebrow")}
        </p>
        <h1 className="text-3xl font-bold text-blue-950 sm:text-4xl">{t("wordLookup.title")}</h1>
      </div>

      <form className="space-y-4" onSubmit={handleSearch}>
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">{t("addWord.englishWord")}</span>
          <div className="relative mt-2">
            <input
              ref={inputRef}
              autoFocus
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-4 pr-11 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              onChange={(event) => {
                setTerm(event.target.value);
                setSaveMessage("");
              }}
              onKeyDown={handleTermKeyDown}
              placeholder={t("wordLookup.searchPlaceholder")}
              value={term}
            />
            {term ? (
              <button
                aria-label={t("wordLookup.clearSearch")}
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-lg leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                onClick={handleClearTerm}
                type="button"
              >
                ×
              </button>
            ) : null}
          </div>
        </label>

        <button
          className="w-full rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:bg-slate-300"
          disabled={isSearching || isSaving}
          type="submit"
        >
          {isSearching ? t("wordLookup.searching") : t("wordLookup.search")}
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      {saveMessage ? (
        <p className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {saveMessage}
        </p>
      ) : null}

      {!lookupResult && !error ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
          <p className="text-4xl" aria-hidden="true">
            🔍
          </p>
          <p className="mt-3 font-bold text-slate-700">{t("wordLookup.emptyTitle")}</p>
          <p className="mt-1 text-sm text-slate-500">{t("wordLookup.emptyDescription")}</p>
        </div>
      ) : null}

      {lookupResult && resultValues ? (
        <article className="mt-6 space-y-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
          {!lookupResult.fromWordbase || lookupResult.usedFallback ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              {!lookupResult.fromWordbase ? (
                <LookupSourceBadge sourceKey={getSourceKey(lookupResult)} t={t} />
              ) : null}
              {lookupResult.usedFallback ? (
                <p className="text-xs font-medium text-amber-700">{t("wordLookup.aiFallbackNote")}</p>
              ) : null}
            </div>
          ) : null}

          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-bold text-blue-950">{resultValues.term}</h2>
              <SpeakButton text={resultValues.term} />
            </div>
            {resultValues.pronunciation ? (
              <p className="mt-1 text-sm text-slate-500">{resultValues.pronunciation}</p>
            ) : null}
          </div>

          {hasMemoryImageUrl(lookupResult.memoryImage) ? (
            <figure className="overflow-hidden rounded-2xl border border-sky-100 bg-white">
              <img
                alt={t("wordImage.alt", { term: resultValues.term })}
                className="mx-auto h-auto max-h-[360px] w-full object-contain"
                loading="lazy"
                src={lookupResult.memoryImage.imageUrl}
              />
            </figure>
          ) : null}

          {resultValues.partOfSpeech ? (
            <div>
              <p className="review-word-field-label">{t("addWord.partOfSpeech")}</p>
              <p className="text-base font-semibold text-slate-700">{resultValues.partOfSpeech}</p>
            </div>
          ) : null}

          <div>
            <p className="review-word-field-label">{t("addWord.translation")}</p>
            {resultValues.translation ? (
              <p className="review-word-translation">{resultValues.translation}</p>
            ) : (
              <p className="text-sm font-semibold text-slate-400">{t("common.notYet")}</p>
            )}
          </div>

          <div>
            <p className="review-word-field-label">{t("addWord.definition")}</p>
            <p className="text-base leading-relaxed text-slate-700">{resultValues.definition}</p>
          </div>

          {resultValues.example ? (
            <ExampleSentence
              example={resultValues.example}
              exampleTranslation={resultValues.exampleTranslation}
            />
          ) : null}
        </article>
      ) : null}

      {lookupResult && resultValues && lookupResult.localWordId ? (
        <div className="mt-4 flex flex-col gap-3">
          <Link
            className="inline-flex w-full items-center justify-center rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
            to={`/words/${lookupResult.localWordId}`}
          >
            {t("wordLookup.viewWord")}
          </Link>
          <Link
            className="inline-flex w-full items-center justify-center rounded-full border border-blue-200 bg-white px-5 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
            to="/words"
          >
            {t("wordLookup.viewWordList")}
          </Link>
        </div>
      ) : null}

      {lookupResult && resultValues && canAddToWordList(lookupResult) ? (
        <div className="mt-4 space-y-2">
          <button
            className="inline-flex w-full items-center justify-center rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:bg-slate-300"
            disabled={isSaving}
            onClick={handleAddToWordList}
            type="button"
          >
            {isSaving ? t("common.saving") : t("wordLookup.addToWordList")}
          </button>
          {showGuestLocalHint ? (
            <p className="text-center text-xs text-slate-500">{t("wordLookup.guestLocalHint")}</p>
          ) : null}
          {hasSupabaseConfig && !user?.id ? (
            <p className="text-center text-sm text-slate-600">
              {t("wordLookup.signInPrompt")}{" "}
              <Link className="font-semibold text-blue-700 hover:text-blue-800" to={loginRedirect}>
                {t("wordLookup.signInLink")}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default WordLookupPage;
