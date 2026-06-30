import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import SpeakButton, { speakText } from "../components/SpeakButton.jsx";
import WordMemoryPanel from "../components/WordMemoryPanel.jsx";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import WordGroupScopeEmptyState from "../features/wordGroups/WordGroupScopeEmptyState.jsx";
import { useActiveGroupWordScope } from "../features/wordGroups/useActiveGroupWordScope.js";
import { useEnsureActiveGroupWords } from "../features/wordGroups/useEnsureActiveGroupWords.js";
import { createQuizQuestions } from "../features/review/quizHelpers.js";
import { prefetchSessionMemoryImages } from "../features/review/prefetchSessionMemoryImages.js";
import { updateReviewResult } from "../features/review/reviewHelpers.js";
import { useWordsContext } from "../features/words/WordsContext.jsx";
import { maybeRecordDailyMistakeClear } from "../lib/learningActivity.js";
import { REVIEW_RESULTS } from "../features/words/wordTypes.js";

function QuizPage() {
  const { t } = useLocale();
  const { ensureActiveGroupWordsSynced, isActiveGroupSyncing, updateWord, user, words } = useWordsContext();
  const {
    activeGroup,
    isLoadingScope,
    isGroupScopeActive,
    mappedTermCount,
    scopeReason,
    scopedWords,
  } = useActiveGroupWordScope(words, user);
  useEnsureActiveGroupWords();
  const reviewWords = isGroupScopeActive ? scopedWords : words;
  const reviewWordIdsKey = useMemo(
    () => reviewWords.map((word) => word.id).sort().join("|"),
    [reviewWords],
  );
  const reviewWordsRef = useRef(reviewWords);
  reviewWordsRef.current = reviewWords;
  const initializedQuizKeyRef = useRef(reviewWordIdsKey);
  const [questions, setQuestions] = useState(() => createQuizQuestions(reviewWords));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const questionsLengthRef = useRef(0);

  questionsLengthRef.current = questions.length;

  const currentQuestion = questions[currentIndex];
  const currentWord =
    reviewWords.find((word) => word.id === currentQuestion?.word.id) ?? currentQuestion?.word;
  const progressText = t("quiz.progress", {
    current: Math.min(currentIndex + 1, questions.length),
    total: questions.length,
  });

  useEffect(() => {
    if (!isGroupScopeActive || mappedTermCount === 0 || scopedWords.length > 0) {
      return;
    }

    void ensureActiveGroupWordsSynced();
  }, [
    ensureActiveGroupWordsSynced,
    isGroupScopeActive,
    mappedTermCount,
    scopedWords.length,
  ]);

  useEffect(() => {
    if (initializedQuizKeyRef.current === reviewWordIdsKey) {
      return;
    }

    initializedQuizKeyRef.current = reviewWordIdsKey;
    setQuestions(createQuizQuestions(reviewWordsRef.current));
    setCurrentIndex(0);
    setSelectedAnswer("");
    setFeedback(null);
    setScore(0);
    setIsComplete(false);
  }, [reviewWordIdsKey]);

  useEffect(() => {
    if (!user || reviewWords.length === 0) {
      return undefined;
    }

    let cancelled = false;

    void prefetchSessionMemoryImages(reviewWords, { updateWord, user }).catch((error) => {
      if (!cancelled) {
        console.warn("Could not prefetch quiz memory images from wordbase.", error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [reviewWordIdsKey, reviewWords, updateWord, user]);

  useEffect(() => {
    if (isComplete || feedback || !currentQuestion?.word?.term) {
      return;
    }

    speakText(currentQuestion.word.term);
  }, [currentIndex, currentQuestion?.word?.term, feedback, isComplete]);

  function handleAnswer(answer) {
    if (feedback) {
      return;
    }

    const isCorrect = answer === currentQuestion.correctAnswer;
    const result = isCorrect
      ? REVIEW_RESULTS.CORRECT
      : REVIEW_RESULTS.INCORRECT;

    setSelectedAnswer(answer);
    setScore((currentScore) => currentScore + (isCorrect ? 1 : 0));
    maybeRecordDailyMistakeClear(currentQuestion.word, result);
    updateWord(currentQuestion.word.id, updateReviewResult(currentQuestion.word, result));

    if (isCorrect) {
      handleNextQuestion();
      return;
    }

    setFeedback("incorrect");
  }

  function handleNextQuestion() {
    setSelectedAnswer("");
    setFeedback(null);

    setCurrentIndex((index) => {
      if (index >= questionsLengthRef.current - 1) {
        setIsComplete(true);
        return index;
      }

      return index + 1;
    });
  }

  if (isLoadingScope) {
    return (
      <section className="w-full max-w-3xl rounded-3xl border border-blue-200/70 bg-white/90 p-8 text-center shadow-2xl shadow-blue-950/10 sm:p-14">
        <p className="text-sm font-medium text-slate-600">{t("wordGroupsScope.loading")}</p>
      </section>
    );
  }

  if (isGroupScopeActive && reviewWords.length === 0) {
    return (
      <section className="w-full max-w-3xl rounded-3xl border border-blue-200/70 bg-white/90 p-8 shadow-2xl shadow-blue-950/10 sm:p-14">
        <WordGroupScopeEmptyState
          activeGroup={activeGroup}
          isImporting={isActiveGroupSyncing}
          scopeReason={scopeReason}
        />
      </section>
    );
  }

  if (questions.length === 0) {
    return (
      <section className="w-full max-w-3xl rounded-3xl border border-blue-200/70 bg-white/90 p-8 text-center shadow-2xl shadow-blue-950/10 sm:p-14">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
          {t("quiz.eyebrow")}
        </p>
        <h1 className="text-4xl font-bold text-blue-950 sm:text-5xl">
          {t("quiz.notEnoughTitle")}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-600">
          {t("quiz.notEnoughDescription")}
        </p>
        <Link
          className="mt-8 inline-flex rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
          to="/words/new"
        >
          {t("common.addWord")}
        </Link>
      </section>
    );
  }

  if (isComplete) {
    return (
      <section className="w-full max-w-3xl rounded-3xl border border-blue-200/70 bg-white/90 p-8 text-center shadow-2xl shadow-blue-950/10 sm:p-14">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
          {t("quiz.completeEyebrow")}
        </p>
        <h1 className="text-4xl font-bold text-blue-950 sm:text-5xl">
          {t("quiz.completeTitle")}
        </h1>
        <p className="mt-6 text-6xl font-bold text-blue-700">
          {score}/{questions.length}
        </p>
        <p className="mx-auto mt-4 max-w-xl text-slate-600">
          {t("quiz.completeDescription")}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            className="rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
            to="/mistakes"
          >
            {t("quiz.viewMistakes")}
          </Link>
          <Link
            className="rounded-full bg-blue-100 px-5 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-200"
            to="/words"
          >
            {t("quiz.backToList")}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-3xl rounded-3xl border border-blue-200/70 bg-white/90 p-6 shadow-2xl shadow-blue-950/10 sm:p-10">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
            {t("quiz.eyebrow")}
          </p>
          <h1 className="text-4xl font-bold text-blue-950 sm:text-5xl">
            {t("quiz.title")}
          </h1>
        </div>
        <p className="rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-700">
          {progressText}
        </p>
      </div>

      <div className="rounded-3xl border border-blue-100 bg-blue-50/70 p-8 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-700">
          {t("quiz.chooseTranslation")}
        </p>
        <div className="mt-4 flex flex-col items-center gap-3">
          <h2 className="text-5xl font-bold text-blue-950">
            {currentQuestion.word.term}
          </h2>
          <SpeakButton text={currentQuestion.word.term} />
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {currentQuestion.options.map((option, optionIndex) => {
          const isSelected = selectedAnswer === option.wordId;
          const isCorrectAnswer = option.wordId === currentQuestion.correctAnswer;
          const showCorrect = feedback === "incorrect" && isCorrectAnswer;
          const showIncorrect = feedback === "incorrect" && isSelected;

          return (
            <button
              className={[
                "rounded-2xl border px-5 py-4 text-left font-semibold transition",
                showCorrect
                  ? "border-green-300 bg-green-50 text-green-800"
                  : "",
                showIncorrect ? "border-red-300 bg-red-50 text-red-800" : "",
                !showCorrect && !showIncorrect
                  ? "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                  : "",
              ].join(" ")}
              disabled={Boolean(feedback)}
              key={`${option.wordId}-${optionIndex}`}
              onClick={() => handleAnswer(option.wordId)}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {feedback === "incorrect" ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <p className="font-bold text-red-700">{t("quiz.incorrect")}</p>
          <p className="mt-2 text-slate-600">
            {t("quiz.correctAnswer", {
              answer: currentQuestion.correctLabel,
            })}
          </p>
          <div className="mt-4">
            <WordMemoryPanel autoLoad compact word={currentWord} />
          </div>
          <button
            className="mt-5 rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
            onClick={handleNextQuestion}
            type="button"
          >
            {currentIndex >= questions.length - 1
              ? t("quiz.finishQuiz")
              : t("quiz.nextQuestion")}
          </button>
        </div>
      ) : null}
    </section>
  );
}

export default QuizPage;
