import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ReviewWordListItem from "../components/ReviewWordListItem.jsx";
import SpeakButton, { speakText } from "../components/SpeakButton.jsx";
import WordMemoryPanel from "../components/WordMemoryPanel.jsx";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { createImageQuizQuestions } from "../features/review/imageQuizHelpers.js";
import { prefetchSessionMemoryImages } from "../features/review/prefetchSessionMemoryImages.js";
import {
  getReviewIntervalDays,
  getReviewSessionWords,
  updateReviewResult,
} from "../features/review/reviewHelpers.js";
import { useWordsContext } from "../features/words/WordsContext.jsx";
import { syncReviewSession } from "../lib/reviewSessionStorage.js";
import { REVIEW_RESULTS } from "../features/words/wordTypes.js";

function FlashcardsPage() {
  const { t } = useLocale();
  const { updateWord, user, words } = useWordsContext();
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
  const [isPreparing, setIsPreparing] = useState(false);
  const [prepareProgress, setPrepareProgress] = useState({ current: 0, total: 0 });
  const [prepareError, setPrepareError] = useState("");
  const [imageQuestions, setImageQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [clearedReviewDays, setClearedReviewDays] = useState(1);
  const [sessionClearedCount, setSessionClearedCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const currentQuestion = imageQuestions[currentIndex];
  const currentWord =
    words.find((word) => word.id === currentQuestion?.word.id) ?? currentQuestion?.word;
  const progressText = t("flashcards.progress", {
    current: Math.min(currentIndex + 1, imageQuestions.length || sessionWords.length),
    total: imageQuestions.length || sessionWords.length,
  });

  function handleStartReview() {
    void startReview();
  }

  async function startReview() {
    syncReviewSession({
      mistakesOnly,
      totalCount,
      wordIds: sessionWords.map((word) => word.id),
    });

    setPrepareError("");
    setIsPreparing(true);
    setPrepareProgress({ current: 0, total: sessionWords.length });

    try {
      await prefetchSessionMemoryImages(sessionWords, {
        onProgress: (current, total) => {
          setPrepareProgress({ current, total });
        },
        updateWord,
        user,
      });

      const questions = createImageQuizQuestions(sessionWords, words);

      if (questions.length === 0) {
        setPrepareError(t("flashcards.notEnoughImages"));
        return;
      }

      setImageQuestions(questions);
      setCurrentIndex(0);
      setFeedback(null);
      setSessionClearedCount(0);
      setIsComplete(false);
      setHasStarted(true);
    } catch (error) {
      setPrepareError(error.message);
    } finally {
      setIsPreparing(false);
    }
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

  useEffect(() => {
    if (!hasStarted || isComplete || isPreparing || feedback || !currentWord?.term) {
      return;
    }

    speakText(currentWord.term);
  }, [currentIndex, currentWord?.term, feedback, hasStarted, isComplete, isPreparing]);

  function goToNextWord() {
    setFeedback(null);

    if (currentIndex >= imageQuestions.length - 1) {
      setIsComplete(true);
      return;
    }

    setCurrentIndex((index) => index + 1);
  }

  function handleBackToReviewList() {
    setHasStarted(false);
    setIsComplete(false);
    setCurrentIndex(0);
    setFeedback(null);
    setImageQuestions([]);
    setSessionClearedCount(0);
    setPrepareError("");
  }

  function getNextReviewMessage(days) {
    if (days <= 1) {
      return t("flashcards.nextReviewTomorrow");
    }

    return t("flashcards.nextReviewInDays", { days });
  }

  function handleImageAnswer(answerWordId) {
    if (feedback || !currentQuestion) {
      return;
    }

    const isCorrect = answerWordId === currentQuestion.correctAnswer;
    const result = isCorrect ? REVIEW_RESULTS.REMEMBERED : REVIEW_RESULTS.FORGOT;
    const hadMistake = currentQuestion.word.mistake?.isMistake;

    updateWord(currentQuestion.word.id, updateReviewResult(currentQuestion.word, result));

    if (!isCorrect) {
      setFeedback("incorrect");
      return;
    }

    if (hadMistake) {
      const nextLevel = currentQuestion.word.review.level + 1;
      setClearedReviewDays(getReviewIntervalDays(nextLevel));
      setSessionClearedCount((count) => count + 1);
      setFeedback("cleared");
      return;
    }

    goToNextWord();
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
            className="inline-flex justify-center rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-800 disabled:bg-slate-300"
            disabled={isPreparing}
            onClick={handleStartReview}
            type="button"
          >
            {isPreparing
              ? t("flashcards.preparingImages", {
                  current: prepareProgress.current,
                  total: prepareProgress.total,
                })
              : t("flashcards.startReview")}
          </button>
        </div>

        {prepareError ? (
          <p className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {prepareError}
          </p>
        ) : null}

        <ul className="space-y-4">
          {sessionWords.map((word) => (
            <ReviewWordListItem
              actions={
                <Link
                  className="rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-200"
                  to={`/words/${word.id}`}
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
          {mistakesOnly
            ? t("flashcards.completeDescriptionMistakes", {
                cleared: sessionClearedCount,
                remaining: words.filter((word) => word.mistake.isMistake).length,
              })
            : t("flashcards.completeDescription", { count: imageQuestions.length })}
        </p>
        {mistakesOnly ? (
          <Link
            className="mt-8 inline-flex rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
            to="/mistakes"
          >
            {t("flashcards.backToMistakes")}
          </Link>
        ) : (
          <button
            className="mt-8 inline-flex rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
            onClick={handleBackToReviewList}
            type="button"
          >
            {t("flashcards.backToReview")}
          </button>
        )}
      </section>
    );
  }

  if (!currentQuestion || !currentWord) {
    return null;
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

      {feedback === null ? (
        <div className="mt-6">
          <p className="mb-4 text-center text-sm font-bold uppercase tracking-[0.14em] text-slate-500">
            {t("flashcards.chooseMemoryImage")}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {currentQuestion.options.map((option, optionIndex) => (
              <button
                className="relative overflow-hidden rounded-2xl border-2 border-slate-200 bg-white transition hover:border-blue-400 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                key={`${option.wordId}-${optionIndex}`}
                onClick={() => handleImageAnswer(option.wordId)}
                type="button"
              >
                <img
                  alt={t("wordImage.alt", { term: currentWord.term })}
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                  src={option.imageUrl}
                />
                {option.translation ? (
                  <span className="flashcard-image-translation-overlay review-word-translation">
                    {option.translation}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : feedback === "cleared" ? (
        <div className="mt-6 rounded-2xl border border-green-200 bg-green-50/60 p-5">
          <p className="font-bold text-green-700">{t("quiz.correct")}</p>
          <p className="mt-2 text-slate-700">{t("flashcards.clearedFromMistakes")}</p>
          <p className="mt-1 text-sm font-semibold text-green-800">
            {getNextReviewMessage(clearedReviewDays)}
          </p>
          <button
            className="mt-5 rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
            onClick={goToNextWord}
            type="button"
          >
            {currentIndex >= imageQuestions.length - 1
              ? t("flashcards.finishReview")
              : t("flashcards.nextWord")}
          </button>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50/60 p-5">
          <p className="font-bold text-red-700">{t("flashcards.incorrect")}</p>
          {currentWord.translation ? (
            <p className="mt-2 text-slate-700">
              {t("quiz.correctAnswer", { answer: currentWord.translation })}
            </p>
          ) : null}
          <div className="mt-4">
            <WordMemoryPanel autoLoad compact={false} word={currentWord} />
          </div>
          <button
            className="mt-5 rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
            onClick={goToNextWord}
            type="button"
          >
            {currentIndex >= imageQuestions.length - 1
              ? t("flashcards.finishReview")
              : t("flashcards.nextWord")}
          </button>
        </div>
      )}
    </section>
  );
}

export default FlashcardsPage;
