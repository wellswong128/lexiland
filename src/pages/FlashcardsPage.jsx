import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import ExampleSentence from "../components/ExampleSentence.jsx";
import ReviewWordListItem from "../components/ReviewWordListItem.jsx";
import SpeakButton from "../components/SpeakButton.jsx";
import WordMemoryPanel from "../components/WordMemoryPanel.jsx";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import {
  getReviewSessionWords,
  updateReviewResult,
} from "../features/review/reviewHelpers.js";
import { useWordsContext } from "../features/words/WordsContext.jsx";
import { syncReviewSession } from "../lib/reviewSessionStorage.js";
import { REVIEW_RESULTS } from "../features/words/wordTypes.js";

function FlashcardReviewButtons({ onForgot, onRemembered, t }) {
  return (
    <div className="mt-4 flex gap-3">
      <button
        className="flex-1 rounded-full bg-red-50 px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100"
        onClick={onForgot}
        type="button"
      >
        {t("flashcards.forgot")}
      </button>
      <button
        className="flex-1 rounded-full bg-green-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-green-700"
        onClick={onRemembered}
        type="button"
      >
        {t("flashcards.remembered")}
      </button>
    </div>
  );
}

function FlashcardsPage() {
  const location = useLocation();
  const { t } = useLocale();
  const { updateWord, words } = useWordsContext();
  const [searchParams] = useSearchParams();
  const mistakesOnly = searchParams.get("mode") === "mistakes";
  const { isLimited, sessionWords, totalCount } = useMemo(
    () =>
      getReviewSessionWords(words, {
        mistakesOnly,
      }),
    [mistakesOnly, words],
  );
  const [hasStarted, setHasStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const currentWord =
    words.find((word) => word.id === sessionWords[currentIndex]?.id) ??
    sessionWords[currentIndex];
  const progressText = t("flashcards.progress", {
    current: Math.min(currentIndex + 1, sessionWords.length),
    total: sessionWords.length,
  });

  function handleStartReview() {
    syncReviewSession({
      mistakesOnly,
      totalCount,
      wordIds: sessionWords.map((word) => word.id),
    });
    setHasStarted(true);
  }

  useEffect(() => {
    if (hasStarted || sessionWords.length === 0) {
      return;
    }

    syncReviewSession({
      mistakesOnly,
      totalCount,
      wordIds: sessionWords.map((word) => word.id),
    });
  }, [hasStarted, mistakesOnly, sessionWords, totalCount]);

  function handleReview(result) {
    updateWord(currentWord.id, updateReviewResult(currentWord, result));
    setShowAnswer(false);

    if (currentIndex >= sessionWords.length - 1) {
      setIsComplete(true);
      return;
    }

    setCurrentIndex((index) => index + 1);
  }

  if (sessionWords.length === 0) {
    return (
      <section className="w-full max-w-3xl rounded-3xl border border-blue-200/70 bg-white/90 p-8 text-center shadow-2xl shadow-blue-950/10 sm:p-14">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
          {t("flashcards.eyebrow")}
        </p>
        <h1 className="text-4xl font-bold text-blue-950 sm:text-5xl">
          {t("flashcards.noDueTitle")}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-600">
          {mistakesOnly
            ? t("flashcards.noDueMistakes")
            : t("flashcards.noDueDefault")}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            className="rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
            to="/words/new"
          >
            {t("common.addWord")}
          </Link>
          <Link
            className="rounded-full bg-blue-100 px-5 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-200"
            to="/words"
          >
            {t("common.wordList")}
          </Link>
        </div>
      </section>
    );
  }

  if (!hasStarted) {
    return (
      <section className="w-full max-w-4xl rounded-3xl border border-blue-200/70 bg-white/90 p-6 shadow-2xl shadow-blue-950/10 sm:p-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
              {t("flashcards.listEyebrow")}
            </p>
            <h1 className="text-4xl font-bold text-blue-950 sm:text-5xl">
              {mistakesOnly ? t("flashcards.listTitleMistakes") : t("flashcards.listTitle")}
            </h1>
            <p className="mt-4 text-slate-600">
              {mistakesOnly
                ? t("flashcards.listCountMistakes", { count: totalCount })
                : t("flashcards.listCount", { count: totalCount })}
            </p>
            {isLimited ? (
              <p className="mt-2 text-sm font-semibold text-amber-800">
                {t("flashcards.reviewFirstTenOnly")}
              </p>
            ) : null}
          </div>

          <button
            className="inline-flex justify-center rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-800"
            onClick={handleStartReview}
            type="button"
          >
            {t("flashcards.startReview")}
          </button>
        </div>

        <ul className="space-y-4">
          {sessionWords.map((word) => (
            <ReviewWordListItem
              actions={
                <Link
                  className="rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-200"
                  to={`/words/${word.id}`}
                  state={{ from: location.pathname + location.search }}
                >
                  {t("common.details")}
                </Link>
              }
              key={word.id}
              memoryPanelCompact={false}
              showMemoryPanel
              t={t}
              word={word}
            />
          ))}
        </ul>
      </section>
    );
  }

  if (isComplete) {
    return (
      <section className="w-full max-w-3xl rounded-3xl border border-blue-200/70 bg-white/90 p-8 text-center shadow-2xl shadow-blue-950/10 sm:p-14">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
          {t("flashcards.completeEyebrow")}
        </p>
        <h1 className="text-4xl font-bold text-blue-950 sm:text-5xl">
          {t("flashcards.completeTitle")}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-600">
          {t("flashcards.completeDescription", { count: sessionWords.length })}
        </p>
        <Link
          className="mt-8 inline-flex rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
          to="/words"
        >
          {t("flashcards.backToList")}
        </Link>
      </section>
    );
  }

  return (
    <section className="w-full max-w-3xl rounded-3xl border border-blue-200/70 bg-white/90 p-6 shadow-2xl shadow-blue-950/10 sm:p-10">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
            {t("flashcards.eyebrow")}
          </p>
          <h1 className="text-4xl font-bold text-blue-950 sm:text-5xl">
            {t("flashcards.title")}
          </h1>
        </div>
        <p className="rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-700">
          {progressText}
        </p>
      </div>

      <div className="rounded-3xl border border-blue-100 bg-blue-50/70 p-8 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-700">
          {t("flashcards.word")}
        </p>
        <div className="mt-4 flex flex-col items-center gap-3">
          <h2 className="text-5xl font-bold text-blue-950">{currentWord.term}</h2>
          <SpeakButton text={currentWord.term} />
        </div>

        {currentWord.pronunciation ? (
          <p className="mt-3 text-slate-500">{currentWord.pronunciation}</p>
        ) : null}
      </div>

      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6">
        {showAnswer ? (
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-slate-500">
              {t("flashcards.answer")}
            </p>
            {currentWord.translation ? (
              <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-center text-2xl font-bold leading-8 text-amber-950 shadow-sm sm:text-3xl">
                {currentWord.translation}
              </p>
            ) : null}
            <FlashcardReviewButtons
              onForgot={() => handleReview(REVIEW_RESULTS.FORGOT)}
              onRemembered={() => handleReview(REVIEW_RESULTS.REMEMBERED)}
              t={t}
            />
            {currentWord.example ? (
              <ExampleSentence
                className="mt-3 rounded-2xl bg-slate-50 p-4"
                example={currentWord.example}
                exampleTranslation={currentWord.exampleTranslation}
                showLabel={false}
              />
            ) : null}
            <div className="mt-4">
              <WordMemoryPanel autoLoad compact={false} word={currentWord} />
            </div>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-slate-600">{t("flashcards.recallPrompt")}</p>
            <button
              className="mt-5 rounded-full bg-blue-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
              onClick={() => setShowAnswer(true)}
              type="button"
            >
              {t("flashcards.showAnswer")}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export default FlashcardsPage;
