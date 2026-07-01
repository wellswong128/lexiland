import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ReviewWordListItem from "../components/ReviewWordListItem.jsx";
import SpeakButton, { primeSpeechSynthesis, speakText, unlockSpeechSynthesis } from "../components/SpeakButton.jsx";
import WordImageWithTranslationOverlay from "../components/WordImageWithTranslationOverlay.jsx";
import WordMemoryPanel from "../components/WordMemoryPanel.jsx";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import {
  getImageReviewReadiness,
} from "../features/review/imageQuizHelpers.js";
import { prefetchImageReviewPool } from "../features/review/prefetchImageReviewPool.js";
import WordGroupScopeEmptyState from "../features/wordGroups/WordGroupScopeEmptyState.jsx";
import { useActiveGroupWordScope } from "../features/wordGroups/useActiveGroupWordScope.js";
import { useEnsureActiveGroupWords } from "../features/wordGroups/useEnsureActiveGroupWords.js";
import {
  filterWordsToGroupScope,
  getReviewSessionWords,
  updateReviewResult,
} from "../features/review/reviewHelpers.js";
import { useWordsContext } from "../features/words/WordsContext.jsx";
import { clearReviewSession, syncReviewSession } from "../lib/reviewSessionStorage.js";
import { maybeRecordDailyMistakeClear } from "../lib/learningActivity.js";
import { REVIEW_RESULTS } from "../features/words/wordTypes.js";

function FlashcardsMissingImagesPanel({ imageReviewReadiness, t }) {
  const { missingSessionWords, poolCount, needsMorePoolWords } = imageReviewReadiness;

  if (missingSessionWords.length === 0 && !needsMorePoolWords) {
    return null;
  }

  return (
    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-950">
      {needsMorePoolWords ? (
        <p className="font-semibold leading-6">
          {t("flashcards.imagePoolTooSmall", { count: poolCount })}
        </p>
      ) : null}
      {missingSessionWords.length > 0 ? (
        <>
          <p className={`font-semibold leading-6 ${needsMorePoolWords ? "mt-3" : ""}`}>
            {t("flashcards.missingImagesTitle", { count: missingSessionWords.length })}
          </p>
          <ul className="mt-2 space-y-1">
            {missingSessionWords.map((word) => (
              <li key={word.id}>
                <Link
                  className="font-bold text-blue-700 transition hover:text-blue-900 hover:underline"
                  to={`/words/${word.id}`}
                >
                  {word.term}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function FlashcardsPrepareErrorActions({
  canQuiz,
  isSyncingMemory,
  mistakesOnly,
  onRetry,
  onSyncMemory,
  t,
}) {
  return (
    <div className="mb-6 flex flex-wrap justify-center gap-3">
      <button
        className="rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:bg-slate-300"
        disabled={isSyncingMemory}
        onClick={onSyncMemory}
        type="button"
      >
        {isSyncingMemory
          ? t("flashcards.syncingWordbaseMemory")
          : t("flashcards.syncWordbaseMemoryCta")}
      </button>
      {canQuiz ? (
        <Link
          className="rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
          to="/review/quiz"
        >
          {t("flashcards.prepareTryQuizCta")}
        </Link>
      ) : (
        <Link
          className="rounded-full bg-green-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-green-800"
          to="/words/new?tab=photo"
        >
          {t("flashcards.prepareAddWordsCta")}
        </Link>
      )}
      {mistakesOnly ? (
        <Link
          className="rounded-full bg-blue-100 px-5 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-200"
          to="/mistakes"
        >
          {t("flashcards.noDueBackMistakesCta")}
        </Link>
      ) : (
        <Link
          className="rounded-full bg-blue-100 px-5 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-200"
          to="/words"
        >
          {t("flashcards.noDueWordListCta")}
        </Link>
      )}
      <button
        className="rounded-full border border-blue-200 bg-white px-5 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
        onClick={onRetry}
        type="button"
      >
        {t("flashcards.prepareRetryCta")}
      </button>
      <Link
        className="rounded-full border border-blue-200 bg-white px-5 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
        to="/"
      >
        {t("flashcards.noDueHomeCta")}
      </Link>
    </div>
  );
}

function FlashcardsPage() {
  const { locale, t } = useLocale();
  const { ensureActiveGroupWordsSynced, isActiveGroupSyncing, syncGroupWordMemoryFromServer, updateWord, user, words } = useWordsContext();
  const {
    activeGroup,
    isLoadingScope,
    isGroupScopeActive,
    mappedTermCount,
    mappedTerms,
    scopeReason,
    scopedWords,
    scopeRevision,
  } = useActiveGroupWordScope(words, user);
  useEnsureActiveGroupWords();
  const reviewWords = isGroupScopeActive ? scopedWords : words;
  const isScopePending =
    isGroupScopeActive &&
    (isLoadingScope || (isActiveGroupSyncing && scopedWords.length === 0));
  const [searchParams] = useSearchParams();
  const mistakesOnly = searchParams.get("mode") === "mistakes";
  const { isLimited, sessionWords, totalCount } = useMemo(
    () =>
      getReviewSessionWords(reviewWords, {
        mistakesOnly,
      }),
    [mistakesOnly, reviewWords],
  );
  const imageReviewReadiness = useMemo(
    () => getImageReviewReadiness(sessionWords, reviewWords),
    [reviewWords, sessionWords],
  );
  const canQuiz = reviewWords.length >= 2;
  const [hasStarted, setHasStarted] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [prepareProgress, setPrepareProgress] = useState({ current: 0, total: 0 });
  const [prepareError, setPrepareError] = useState("");
  const [prepareErrorCode, setPrepareErrorCode] = useState("");
  const [imageQuestions, setImageQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [sessionClearedCount, setSessionClearedCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isReviewMemorySyncing, setIsReviewMemorySyncing] = useState(false);
  const [reviewMemorySyncError, setReviewMemorySyncError] = useState("");
  const imageQuestionsRef = useRef([]);
  const imageQuestionsLengthRef = useRef(0);
  const lastSpokenRef = useRef({ index: -1, term: "" });
  const wordsRef = useRef(words);
  wordsRef.current = words;
  const lastScopeRevisionRef = useRef(scopeRevision);
  const quizBottomRef = useRef(null);

  imageQuestionsRef.current = imageQuestions;
  imageQuestionsLengthRef.current = imageQuestions.length;

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
    if (lastScopeRevisionRef.current === scopeRevision) {
      return;
    }

    lastScopeRevisionRef.current = scopeRevision;
    clearReviewSession();
    setHasStarted(false);
    setIsComplete(false);
    setCurrentIndex(0);
    setSelectedAnswer("");
    setFeedback(null);
    setImageQuestions([]);
    setSessionClearedCount(0);
    setPrepareError("");
    setPrepareErrorCode("");
    lastSpokenRef.current = { index: -1, term: "" };
  }, [scopeRevision]);

  function scrollQuizToBottom() {
    const scrollToEnd = () => {
      quizBottomRef.current?.scrollIntoView({ block: "end", behavior: "auto" });

      const scrollingElement = document.scrollingElement;
      if (scrollingElement) {
        scrollingElement.scrollTop = scrollingElement.scrollHeight;
      }

      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "auto" });
    };

    scrollToEnd();
    requestAnimationFrame(scrollToEnd);
  }

  const currentQuestion = imageQuestions[currentIndex];
  const currentWord =
    reviewWords.find((word) => word.id === currentQuestion?.word.id) ?? currentQuestion?.word;
  const progressText = t("flashcards.progress", {
    current: Math.min(currentIndex + 1, imageQuestions.length || sessionWords.length),
    total: imageQuestions.length || sessionWords.length,
  });

  function speakWordAtIndex(index, { force = false } = {}) {
    const term = imageQuestionsRef.current[index]?.word?.term?.trim();

    if (!term) {
      return false;
    }

    if (
      !force &&
      lastSpokenRef.current.index === index &&
      lastSpokenRef.current.term === term
    ) {
      return false;
    }

    lastSpokenRef.current = { index, term };
    speakText(term);
    return true;
  }

  const runReviewMemorySync = useCallback(async () => {
    if (!user) {
      return wordsRef.current;
    }

    setIsReviewMemorySyncing(true);
    setReviewMemorySyncError("");

    try {
      const { words: syncedWords } = await syncGroupWordMemoryFromServer({ terms: null });
      return syncedWords;
    } catch (error) {
      setReviewMemorySyncError(error.message || t("flashcards.syncWordbaseMemoryFailed"));
      return wordsRef.current;
    } finally {
      setIsReviewMemorySyncing(false);
    }
  }, [syncGroupWordMemoryFromServer, t, user]);

  function handleStartReview() {
    primeSpeechSynthesis();
    unlockSpeechSynthesis();
    void startReview();
  }

  async function startReview() {
    syncReviewSession({
      mistakesOnly,
      totalCount,
      wordIds: sessionWords.map((word) => word.id),
    });

    setPrepareError("");
    setPrepareErrorCode("");
    setIsPreparing(true);
    setPrepareProgress({ current: 0, total: sessionWords.length });

    try {
      const syncedWords = await runReviewMemorySync();
      const freshReviewWords = filterWordsToGroupScope(syncedWords, {
        isGroupScopeActive,
        mappedTerms,
      });
      const { sessionWords: freshSessionWords } = getReviewSessionWords(freshReviewWords, {
        mistakesOnly,
      });

      const { questions } = await prefetchImageReviewPool(freshSessionWords, freshReviewWords, {
        onProgress: (current, total) => {
          setPrepareProgress({ current, total });
        },
        updateWord,
      });

      if (questions.length === 0) {
        setPrepareError(t("flashcards.notEnoughImages"));
        setPrepareErrorCode("notEnoughImages");
        return;
      }

      imageQuestionsRef.current = questions;
      setImageQuestions(questions);
      setCurrentIndex(0);
      setSelectedAnswer("");
      setFeedback(null);
      setSessionClearedCount(0);
      setIsComplete(false);
      setHasStarted(true);
      lastSpokenRef.current = { index: -1, term: "" };
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
    if (hasStarted || !user || sessionWords.length === 0) {
      return undefined;
    }

    let cancelled = false;

    void runReviewMemorySync();

    return () => {
      cancelled = true;
    };
  }, [hasStarted, runReviewMemorySync, sessionWords.length, user]);

  useEffect(() => {
    if (!hasStarted || isComplete || feedback || imageQuestions.length === 0) {
      return undefined;
    }

    const isFirstQuestion = currentIndex === 0;
    const delayMs = isFirstQuestion ? 400 : 120;

    const timerId = window.setTimeout(() => {
      speakWordAtIndex(currentIndex);
    }, delayMs);

    const retryId = isFirstQuestion
      ? window.setTimeout(() => {
          if (lastSpokenRef.current.index !== 0) {
            speakWordAtIndex(0, { force: true });
          }
        }, 1200)
      : undefined;

    return () => {
      window.clearTimeout(timerId);
      if (retryId !== undefined) {
        window.clearTimeout(retryId);
      }
    };
  }, [currentIndex, feedback, hasStarted, isComplete, imageQuestions.length]);

  useEffect(() => {
    if (!hasStarted || isComplete || !currentQuestion) {
      return undefined;
    }

    scrollQuizToBottom();
    const shortTimerId = window.setTimeout(scrollQuizToBottom, 150);
    const imageTimerId = window.setTimeout(scrollQuizToBottom, 450);

    return () => {
      window.clearTimeout(shortTimerId);
      window.clearTimeout(imageTimerId);
    };
  }, [currentIndex, currentQuestion?.word.id, feedback, hasStarted, isComplete]);

  function goToNextWord() {
    setSelectedAnswer("");
    setFeedback(null);

    setCurrentIndex((index) => {
      if (index >= imageQuestionsLengthRef.current - 1) {
        setIsComplete(true);
        return index;
      }

      speakWordAtIndex(index + 1);

      return index + 1;
    });
  }

  function handleBackToReviewList() {
    setHasStarted(false);
    setIsComplete(false);
    setCurrentIndex(0);
    setSelectedAnswer("");
    setFeedback(null);
    setImageQuestions([]);
    setSessionClearedCount(0);
    setPrepareError("");
  }

  function handleImageAnswer(answerWordId) {
    if (feedback || !currentQuestion) {
      return;
    }

    const isCorrect = answerWordId === currentQuestion.correctAnswer;
    const result = isCorrect ? REVIEW_RESULTS.REMEMBERED : REVIEW_RESULTS.FORGOT;
    const hadMistake = currentQuestion.word.mistake?.isMistake;

    maybeRecordDailyMistakeClear(currentQuestion.word, result);
    updateWord(currentQuestion.word.id, updateReviewResult(currentQuestion.word, result));

    if (!isCorrect) {
      setSelectedAnswer(answerWordId);
      setFeedback("incorrect");
      return;
    }

    if (hadMistake) {
      setSessionClearedCount((count) => count + 1);
    }

    goToNextWord();
  }

  if (isScopePending) {
    return (
      <section className="w-full max-w-3xl rounded-3xl border border-blue-200/70 bg-white/90 p-8 text-center shadow-2xl shadow-blue-950/10 sm:p-14">
        <p className="text-sm font-medium text-slate-600">{t("wordGroupsScope.loading")}</p>
      </section>
    );
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

  if (!hasStarted && sessionWords.length === 0) {
    const hasWords = reviewWords.length > 0;

    const emptyTitle = mistakesOnly
      ? t("flashcards.noDueTitle")
      : hasWords
        ? t("flashcards.noDueCaughtUpTitle")
        : t("flashcards.noDueTitle");

    const emptyDescription = mistakesOnly
      ? t("flashcards.noDueMistakes")
      : hasWords
        ? t("flashcards.noDueCaughtUpDescription")
        : t("flashcards.noDueEmptyDescription");

    return (
      <section className="w-full max-w-3xl rounded-3xl border border-blue-200/70 bg-white/90 p-8 text-center shadow-2xl shadow-blue-950/10 sm:p-14">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
          {t("flashcards.eyebrow")}
        </p>
        <h1 className="text-4xl font-bold text-blue-950 sm:text-5xl">{emptyTitle}</h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-600">{emptyDescription}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {mistakesOnly ? (
            <>
              <Link
                className="rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
                to="/mistakes"
              >
                {t("flashcards.noDueBackMistakesCta")}
              </Link>
              <Link
                className="rounded-full bg-blue-100 px-5 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-200"
                to="/review/flashcards"
              >
                {t("flashcards.noDueBackFlashcardsCta")}
              </Link>
              <Link
                className="rounded-full border border-blue-200 bg-white px-5 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
                to="/"
              >
                {t("flashcards.noDueHomeCta")}
              </Link>
            </>
          ) : hasWords ? (
            <>
              {canQuiz ? (
                <Link
                  className="rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
                  to="/review/quiz"
                >
                  {t("flashcards.noDueQuizCta")}
                </Link>
              ) : null}
              <Link
                className={[
                  "rounded-full px-5 py-3 text-sm font-bold transition",
                  canQuiz
                    ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                    : "bg-blue-700 text-white hover:bg-blue-800",
                ].join(" ")}
                to="/games/spelling-ninja"
              >
                {t("flashcards.noDueGameCta")}
              </Link>
              <Link
                className="rounded-full bg-green-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-green-800"
                to="/words/new?tab=photo"
              >
                {t("flashcards.noDuePhotoCta")}
              </Link>
              <Link
                className="rounded-full border border-blue-200 bg-white px-5 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
                to="/"
              >
                {t("flashcards.noDueHomeCta")}
              </Link>
              <Link
                className="rounded-full bg-blue-100 px-5 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-200"
                to="/words"
              >
                {t("flashcards.noDueWordListCta")}
              </Link>
            </>
          ) : (
            <>
              <Link
                className="rounded-full bg-green-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-green-800"
                to="/words/new?tab=photo"
              >
                {t("flashcards.noDuePhotoCta")}
              </Link>
              <Link
                className="rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
                to="/words/new?tab=manual"
              >
                {t("common.addWord")}
              </Link>
              <Link
                className="rounded-full border border-blue-200 bg-white px-5 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
                to="/"
              >
                {t("flashcards.noDueHomeCta")}
              </Link>
            </>
          )}
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
            {isReviewMemorySyncing ? (
              <p className="mt-2 text-sm font-semibold text-blue-800">
                {t("flashcards.syncingWordbaseMemory")}
              </p>
            ) : null}
            {reviewMemorySyncError ? (
              <p className="mt-2 text-sm font-semibold text-red-700">{reviewMemorySyncError}</p>
            ) : null}
            {!imageReviewReadiness.canStart && !prepareError ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm font-semibold text-amber-800">
                  {mistakesOnly
                    ? t("flashcards.imageReviewNotReadyMistakesDescription")
                    : t("flashcards.imageReviewNotReadyDescription")}
                </p>
                <FlashcardsMissingImagesPanel imageReviewReadiness={imageReviewReadiness} t={t} />
                <FlashcardsPrepareErrorActions
                  canQuiz={canQuiz}
                  isSyncingMemory={isReviewMemorySyncing}
                  mistakesOnly={mistakesOnly}
                  onRetry={handleStartReview}
                  onSyncMemory={() => {
                    void runReviewMemorySync();
                  }}
                  t={t}
                />
              </div>
            ) : null}
          </div>

          <button
            className="inline-flex justify-center rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-800 disabled:bg-slate-300"
            disabled={isPreparing || isReviewMemorySyncing}
            onClick={handleStartReview}
            type="button"
          >
            {isPreparing
              ? t("flashcards.preparingImages", {
                  current: prepareProgress.current,
                  total: prepareProgress.total,
                })
              : isReviewMemorySyncing
                ? t("flashcards.syncingWordbaseMemory")
                : t("flashcards.startReview")}
          </button>
        </div>

        {prepareError ? (
          <div className="mb-6">
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {prepareError}
            </p>
            {prepareErrorCode === "notEnoughImages" ? (
              <div className="mt-4">
                <FlashcardsMissingImagesPanel imageReviewReadiness={imageReviewReadiness} t={t} />
                <FlashcardsPrepareErrorActions
                  canQuiz={canQuiz}
                  isSyncingMemory={isReviewMemorySyncing}
                  mistakesOnly={mistakesOnly}
                  onRetry={handleStartReview}
                  onSyncMemory={() => {
                    void runReviewMemorySync();
                  }}
                  t={t}
                />
              </div>
            ) : null}
          </div>
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
              showTranslationOverlay
              t={t}
              word={word}
              wordbaseOnly
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
                remaining: reviewWords.filter((word) => word.mistake.isMistake).length,
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

      {feedback === null || feedback === "incorrect" ? (
        <div className="mt-6">
          <p className="mb-4 text-center text-sm font-bold uppercase tracking-[0.14em] text-slate-500">
            {t("flashcards.chooseMemoryImage")}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {currentQuestion.options.map((option, optionIndex) => {
              const isSelected = selectedAnswer === option.wordId;
              const isCorrectAnswer = option.wordId === currentQuestion.correctAnswer;
              const showCorrect = feedback === "incorrect" && isCorrectAnswer;
              const showIncorrect = feedback === "incorrect" && isSelected;

              return (
                <button
                  className={[
                    "relative overflow-hidden rounded-2xl border-2 bg-white transition focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100",
                    showCorrect
                      ? "border-green-400 ring-4 ring-green-100"
                      : "",
                    showIncorrect ? "border-red-400 ring-4 ring-red-100" : "",
                    !showCorrect && !showIncorrect
                      ? "border-slate-200 hover:border-blue-400 hover:shadow-md"
                      : "",
                  ].join(" ")}
                  disabled={Boolean(feedback)}
                  key={`${option.wordId}-${optionIndex}`}
                  onClick={() => handleImageAnswer(option.wordId)}
                  type="button"
                >
                  <WordImageWithTranslationOverlay
                    alt={t("wordImage.alt", { term: currentWord.term })}
                    imageClassName="aspect-square w-full object-cover"
                    src={option.imageUrl}
                    translation={option.translation}
                  />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {feedback === "incorrect" ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50/60 p-5">
          <p className="font-bold text-red-700">{t("flashcards.incorrect")}</p>
          {currentWord.translation ? (
            <p className="mt-2 text-slate-700">
              {t("quiz.correctAnswer", { answer: currentWord.translation })}
            </p>
          ) : null}
          <div className="mt-4">
            <WordMemoryPanel
              autoLoad
              compact={false}
              showTranslationOverlay
              word={currentWord}
              wordbaseOnly
            />
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
      ) : null}
      <div aria-hidden="true" className="h-px w-full shrink-0" ref={quizBottomRef} />
    </section>
  );
}

export default FlashcardsPage;
