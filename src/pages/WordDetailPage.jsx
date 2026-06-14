import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import SpeakButton from "../components/SpeakButton.jsx";
import WordMemoryPanel from "../components/WordMemoryPanel.jsx";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import {
  createDemoSuggestion,
  fetchCompleteWord,
  suggestionToFormValues,
} from "../features/words/completeWordApi.js";
import { useWordsContext } from "../features/words/WordsContext.jsx";

function getFormValues(word) {
  return {
    term: word.term,
    definition: word.definition,
    translation: word.translation,
    pronunciation: word.pronunciation,
    partOfSpeech: word.partOfSpeech,
    example: word.example,
    notes: word.notes,
    tags: Array.isArray(word.tags) ? word.tags.join(", ") : "",
  };
}

function WordDetailPage() {
  const { dateLocale, t } = useLocale();
  const { wordId } = useParams();
  const { updateWord, words } = useWordsContext();
  const word = words.find((currentWord) => currentWord.id === wordId);
  const [isEditing, setIsEditing] = useState(false);
  const [formValues, setFormValues] = useState(null);
  const [error, setError] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  function formatDate(value) {
    if (!value) {
      return t("common.notYet");
    }

    return new Date(value).toLocaleString(dateLocale);
  }

  function displayValue(value) {
    return value || t("common.none");
  }

  useEffect(() => {
    if (word) {
      setFormValues(getFormValues(word));
      setIsEditing(false);
      setError("");
      setAiMessage("");
    }
  }, [word]);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }));
  }

  function handleCancel() {
    setFormValues(getFormValues(word));
    setIsEditing(false);
    setError("");
    setAiMessage("");
  }

  async function handleAiFill() {
    const term = formValues.term.trim();

    if (!term) {
      setError(t("addWord.enterWordFirst"));
      return;
    }

    try {
      setError("");
      setAiMessage("");
      setIsAiLoading(true);

      const { suggestion } = await fetchCompleteWord(term);

      setFormValues((currentValues) => ({
        ...currentValues,
        ...suggestionToFormValues(suggestion),
      }));
      setAiMessage(t("addWord.aiSuccess"));
    } catch (aiError) {
      setFormValues((currentValues) => ({
        ...currentValues,
        ...suggestionToFormValues(createDemoSuggestion(term)),
      }));
      setError("");
      setAiMessage(t("addWord.aiFallback", { reason: aiError.message }));
    } finally {
      setIsAiLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!formValues.term.trim() || !formValues.definition.trim()) {
      setError(t("wordDetail.requiredFields"));
      return;
    }

    updateWord(word.id, formValues);
    setError("");
    setIsEditing(false);
  }

  if (!word) {
    return (
      <section className="w-full max-w-3xl rounded-3xl border border-blue-200/70 bg-white/90 p-8 text-center shadow-2xl shadow-blue-950/10 sm:p-14">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
          {t("wordDetail.eyebrow")}
        </p>
        <h1 className="text-4xl font-bold text-blue-950">
          {t("wordDetail.notFoundTitle")}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-600">
          {t("wordDetail.notFoundDescription")}
        </p>
        <Link
          className="mt-6 inline-flex rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
          to="/words"
        >
          {t("wordDetail.backToList")}
        </Link>
      </section>
    );
  }

  if (!formValues) {
    return null;
  }

  return (
    <section className="w-full max-w-3xl rounded-3xl border border-blue-200/70 bg-white/90 p-6 shadow-2xl shadow-blue-950/10 sm:p-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
            {t("wordDetail.eyebrow")}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-bold text-blue-950 sm:text-5xl">
              {word.term}
            </h1>
            <SpeakButton text={word.term} />
          </div>

          <div className="mt-4">
            <p className="review-word-field-label">{t("common.translation")}</p>
            {word.translation ? (
              <p className="review-word-translation">{word.translation}</p>
            ) : (
              <p className="text-sm font-semibold text-slate-400">{t("common.notYet")}</p>
            )}
          </div>

          {word.example ? (
            <div className="mt-3">
              <p className="review-word-field-label">{t("wordDetail.example")}</p>
              <p className="text-base leading-relaxed text-slate-700">{word.example}</p>
            </div>
          ) : null}

          {!isEditing ? (
            <div className="mt-4">
              <WordMemoryPanel word={word} />
            </div>
          ) : null}
        </div>

        {!isEditing ? (
          <button
            className="rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
            onClick={() => setIsEditing(true)}
            type="button"
          >
            {t("wordDetail.editWord")}
          </button>
        ) : null}
      </div>

      {isEditing ? (
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold text-blue-950">{t("addWord.aiTitle")}</h2>
                <p className="mt-1 text-sm text-slate-600">{t("addWord.aiDescription")}</p>
              </div>
              <button
                className="rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:bg-slate-300"
                disabled={isAiLoading}
                onClick={handleAiFill}
                type="button"
              >
                {isAiLoading ? t("addWord.aiFilling") : t("addWord.aiFill")}
              </button>
            </div>
            {aiMessage ? (
              <p className="mt-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                {aiMessage}
              </p>
            ) : null}
          </div>

          {error ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                {t("addWord.englishWord")}
              </span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                name="term"
                onChange={handleChange}
                value={formValues.term}
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                {t("addWord.partOfSpeech")}
              </span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                name="partOfSpeech"
                onChange={handleChange}
                value={formValues.partOfSpeech}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              {t("addWord.definition")}
            </span>
            <textarea
              className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              name="definition"
              onChange={handleChange}
              value={formValues.definition}
            />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                {t("addWord.translation")}
              </span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                name="translation"
                onChange={handleChange}
                value={formValues.translation}
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                {t("addWord.pronunciation")}
              </span>
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                name="pronunciation"
                onChange={handleChange}
                value={formValues.pronunciation}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              {t("addWord.exampleSentence")}
            </span>
            <textarea
              className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              name="example"
              onChange={handleChange}
              value={formValues.example}
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              {t("wordDetail.notes")}
            </span>
            <textarea
              className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              name="notes"
              onChange={handleChange}
              value={formValues.notes}
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              {t("addWord.tags")}
            </span>
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              name="tags"
              onChange={handleChange}
              value={formValues.tags}
            />
            <span className="mt-2 block text-sm text-slate-500">
              {t("addWord.tagsHint")}
            </span>
          </label>

          <div className="flex flex-wrap justify-end gap-3">
            <button
              className="rounded-full bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
              onClick={handleCancel}
              type="button"
            >
              {t("wordDetail.cancelEdit")}
            </button>
            <button
              className="rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
              type="submit"
            >
              {t("wordDetail.saveChanges")}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-8 space-y-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-blue-50 p-4 sm:col-span-2">
              <dt className="text-sm font-bold text-blue-700">
                {t("addWord.definition")}
              </dt>
              <dd className="mt-1 text-slate-700">{displayValue(word.definition)}</dd>
            </div>
            <div className="rounded-2xl bg-blue-50 p-4">
              <dt className="text-sm font-bold text-blue-700">
                {t("addWord.partOfSpeech")}
              </dt>
              <dd className="mt-1 text-slate-700">
                {displayValue(word.partOfSpeech)}
              </dd>
            </div>
            <div className="rounded-2xl bg-blue-50 p-4">
              <dt className="text-sm font-bold text-blue-700">
                {t("addWord.pronunciation")}
              </dt>
              <dd className="mt-1 text-slate-700">
                {displayValue(word.pronunciation)}
              </dd>
            </div>
            <div className="rounded-2xl bg-blue-50 p-4">
              <dt className="text-sm font-bold text-blue-700">
                {t("addWord.tags")}
              </dt>
              <dd className="mt-1 text-slate-700">
                {word.tags.length > 0 ? word.tags.join(", ") : t("common.none")}
              </dd>
            </div>
            <div className="rounded-2xl bg-blue-50 p-4">
              <dt className="text-sm font-bold text-blue-700">
                {t("wordDetail.source")}
              </dt>
              <dd className="mt-1 text-slate-700">{word.source}</dd>
            </div>
            <div className="rounded-2xl bg-blue-50 p-4">
              <dt className="text-sm font-bold text-blue-700">
                {t("wordDetail.created")}
              </dt>
              <dd className="mt-1 text-slate-700">{formatDate(word.createdAt)}</dd>
            </div>
            <div className="rounded-2xl bg-blue-50 p-4">
              <dt className="text-sm font-bold text-blue-700">
                {t("wordDetail.updated")}
              </dt>
              <dd className="mt-1 text-slate-700">{formatDate(word.updatedAt)}</dd>
            </div>
          </dl>

          <div className="rounded-2xl bg-slate-50 p-4">
            <h2 className="text-sm font-bold text-slate-700">
              {t("wordDetail.notes")}
            </h2>
            <p className="mt-1 text-slate-600">{displayValue(word.notes)}</p>
          </div>
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
        <h2 className="text-lg font-bold text-blue-950">
          {t("wordDetail.reviewStatus")}
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-bold text-blue-700">
              {t("wordDetail.level")}
            </dt>
            <dd className="mt-1 text-slate-700">{word.review.level}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-blue-700">
              {t("wordDetail.nextReview")}
            </dt>
            <dd className="mt-1 text-slate-700">
              {formatDate(word.review.nextReviewAt)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-blue-700">
              {t("wordDetail.correctCount")}
            </dt>
            <dd className="mt-1 text-slate-700">{word.review.correctCount}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-blue-700">
              {t("wordDetail.incorrectCount")}
            </dt>
            <dd className="mt-1 text-slate-700">{word.review.incorrectCount}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-blue-700">
              {t("wordDetail.lastReviewed")}
            </dt>
            <dd className="mt-1 text-slate-700">
              {formatDate(word.review.lastReviewedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-blue-700">
              {t("wordDetail.lastResult")}
            </dt>
            <dd className="mt-1 text-slate-700">
              {displayValue(word.review.lastResult)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-5">
        <h2 className="text-lg font-bold text-slate-800">
          {t("wordDetail.mistakeStatus")}
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-bold text-slate-600">
              {t("wordDetail.inMistakes")}
            </dt>
            <dd className="mt-1 text-slate-700">
              {word.mistake.isMistake ? t("common.yes") : t("common.no")}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-slate-600">
              {t("wordDetail.mistakeCount")}
            </dt>
            <dd className="mt-1 text-slate-700">{word.mistake.mistakeCount}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-slate-600">
              {t("wordDetail.lastMistake")}
            </dt>
            <dd className="mt-1 text-slate-700">
              {formatDate(word.mistake.lastMistakeAt)}
            </dd>
          </div>
        </dl>
      </div>

      <Link
        className="mt-8 inline-flex rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
        to="/words"
      >
        {t("wordDetail.backToList")}
      </Link>
    </section>
  );
}

export default WordDetailPage;
