import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import SpeakButton from "../components/SpeakButton.jsx";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import {
  getDueWords,
  updateReviewResult,
} from "../features/review/reviewHelpers.js";
import { useWordsContext } from "../features/words/WordsContext.jsx";
import { REVIEW_RESULTS } from "../features/words/wordTypes.js";

function FlashcardsPage() {
  const { t } = useLocale();
  const { updateWord, words } = useWordsContext();
  const [searchParams] = useSearchParams();
  const mistakesOnly = searchParams.get("mode") === "mistakes";
  const [sessionWords] = useState(() => {
    const reviewWords = mistakesOnly
      ? words.filter((word) => word.mistake.isMistake)
      : getDueWords(words);

    return reviewWords;
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const currentWord = sessionWords[currentIndex];
  const progressText = t("flashcards.progress", {
    current: Math.min(currentIndex + 1, sessionWords.length),
    total: sessionWords.length,
  });

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
            <p className="mt-3 text-xl font-semibold leading-8 text-slate-800">
              {currentWord.definition}
            </p>
            {currentWord.translation ? (
              <p className="mt-3 text-slate-600">
                {t("common.translation")}: {currentWord.translation}
              </p>
            ) : null}
            {currentWord.example ? (
              <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-slate-600">
                {currentWord.example}
              </p>
            ) : null}
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

      {showAnswer ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            className="rounded-full bg-red-50 px-6 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100"
            onClick={() => handleReview(REVIEW_RESULTS.FORGOT)}
            type="button"
          >
            {t("flashcards.forgot")}
          </button>
          <button
            className="rounded-full bg-green-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-green-700"
            onClick={() => handleReview(REVIEW_RESULTS.REMEMBERED)}
            type="button"
          >
            {t("flashcards.remembered")}
          </button>
        </div>
      ) : null}
    </section>
  );
}

export default FlashcardsPage;
