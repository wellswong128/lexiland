import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ExampleSentence from "../components/ExampleSentence.jsx";
import SpeakButton from "../components/SpeakButton.jsx";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import {
  fetchCompleteWordWithFallback,
  suggestionToFormValues,
} from "../features/words/completeWordApi.js";
import { findWordInLibrary } from "../features/review/gameMistakeHelpers.js";
import { contributeWordDetailsFromSuggestion } from "../features/words/wordbaseApi.js";
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
  const { addWord, user, words } = useWordsContext();
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

    if (result.fromWordbase) {
      return "wordLookup.sourceWordbase";
    }

    return "wordLookup.sourceAi";
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

  function canSaveToLibrary(result) {
    if (!result || result.localWordId || result.usedFallback) {
      return false;
    }

    return result.fromWordbase || (!result.fromLocal && !result.fromWordbase);
  }

  function isAiSource(result) {
    return Boolean(result && !result.fromLocal && !result.fromWordbase && !result.usedFallback);
  }

  async function handleSaveWord() {
    if (!lookupResult?.values || !canSaveToLibrary(lookupResult)) {
      return;
    }

    if (!lookupResult.values.term.trim() || !lookupResult.values.definition.trim()) {
      setError(t("addWord.requiredFields"));
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      const savedWord = await addWord(lookupResult.values);

      if (isAiSource(lookupResult) && lookupResult.suggestion && user?.id) {
        try {
          await contributeWordDetailsFromSuggestion(lookupResult.suggestion, user.id);
        } catch (syncError) {
          console.warn("Could not contribute word details to wordbase.", syncError);
        }
      }

      setSaveMessage(t("wordLookup.saveSuccess"));
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

  const resultValues = lookupResult?.values;

  return (
    <section className="w-full max-w-[430px] rounded-3xl border border-blue-200/70 bg-white/90 p-5 shadow-2xl shadow-blue-950/10 sm:p-8">
      <div className="mb-6 text-center">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
          {t("wordLookup.eyebrow")}
        </p>
        <h1 className="text-3xl font-bold text-blue-950 sm:text-4xl">{t("wordLookup.title")}</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-slate-600">{t("wordLookup.description")}</p>
      </div>

      <form className="space-y-4" onSubmit={handleSearch}>
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">{t("addWord.englishWord")}</span>
          <input
            ref={inputRef}
            autoFocus
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            onChange={(event) => {
              setTerm(event.target.value);
              setSaveMessage("");
            }}
            onKeyDown={handleTermKeyDown}
            placeholder={t("wordLookup.searchPlaceholder")}
            value={term}
          />
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <LookupSourceBadge sourceKey={getSourceKey(lookupResult)} t={t} />
            {lookupResult.usedFallback ? (
              <p className="text-xs font-medium text-amber-700">{t("wordLookup.aiFallbackNote")}</p>
            ) : null}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-bold text-blue-950">{resultValues.term}</h2>
              <SpeakButton text={resultValues.term} />
            </div>
            {resultValues.pronunciation ? (
              <p className="mt-1 text-sm text-slate-500">{resultValues.pronunciation}</p>
            ) : null}
          </div>

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
        <div className="mt-4">
          <Link
            className="inline-flex w-full items-center justify-center rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
            to={`/words/${lookupResult.localWordId}`}
          >
            {t("wordLookup.viewInLibrary")}
          </Link>
        </div>
      ) : null}

      {lookupResult && resultValues && canSaveToLibrary(lookupResult) ? (
        <div className="mt-4">
          <button
            className="inline-flex w-full items-center justify-center rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:bg-slate-300"
            disabled={isSaving}
            onClick={handleSaveWord}
            type="button"
          >
            {isSaving ? t("common.saving") : t("wordLookup.saveWord")}
          </button>
        </div>
      ) : null}
    </section>
  );
}

export default WordLookupPage;
