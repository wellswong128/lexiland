import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import LexiMascot from "../components/LexiMascot.jsx";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import WordScopeModeSwitch from "../features/wordGroups/WordScopeModeSwitch.jsx";
import { getActiveGroupLabel } from "../features/wordGroups/getActiveGroupLabel.js";
import { useActiveGroupWordScope } from "../features/wordGroups/useActiveGroupWordScope.js";
import { getDueWords } from "../features/review/reviewHelpers.js";
import { useWordsContext } from "../features/words/WordsContext.jsx";
import { canRoute, getRoleFromUser } from "../lib/authorization.js";
import { getLearningSnapshot } from "../lib/learningActivity.js";
import { hasSupabaseConfig } from "../lib/supabaseClient.js";

const statCards = [
  {
    key: "savedWords",
    shortKey: "savedWordsShort",
    descKey: "savedWordsDesc",
    valueKey: "words",
    tone: "c1",
    to: "/words",
  },
  {
    key: "dueReviews",
    shortKey: "dueReviewsShort",
    descKey: "dueReviewsDesc",
    valueKey: "due",
    tone: "c2",
    to: "/review/flashcards",
  },
  {
    key: "mistakes",
    shortKey: "mistakesShort",
    descKey: "mistakesDesc",
    valueKey: "mistakes",
    tone: "c3",
    to: "/mistakes",
  },
];

const quickActionLinks = [
  {
    key: "photo",
    labelKey: "addWord.tabPhoto",
    descKey: "home.photoDesc",
    to: "/words/new?tab=photo",
    bg: "home-quick-bg-green",
    iconClass: "home-qi1",
    emoji: "📷",
    featured: true,
  },
  {
    key: "addWord",
    labelKey: "common.addWord",
    descKey: "home.addWordDesc",
    to: "/words/new?tab=manual",
    bg: "home-quick-bg-blue",
    iconClass: "home-qi2",
    emoji: "＋",
  },
  {
    key: "wordList",
    labelKey: "common.wordList",
    descKey: "home.wordListDesc",
    to: "/words",
    bg: "home-quick-bg-purple",
    iconClass: "home-qi3",
    emoji: "📚",
  },
  {
    key: "flashcards",
    labelKey: "home.flashcards",
    descKey: "home.flashcardsDesc",
    to: "/review/flashcards",
    bg: "home-quick-bg-teal",
    iconClass: "home-qi4",
    emoji: "🧩",
  },
  {
    key: "quiz",
    labelKey: "home.startQuiz",
    descKey: "home.quizDesc",
    to: "/review/quiz",
    bg: "home-quick-bg-amber",
    iconClass: "home-qi5",
    emoji: "🏆",
  },
];

const featuredGames = [
  {
    key: "ninja",
    labelKey: "nav.ninjaGame",
    descKey: "home.ninjaDesc",
    to: "/games/spelling-ninja",
    tone: "home-purple",
    art: "🥷",
  },
  {
    key: "penaltyTwelve",
    labelKey: "nav.penaltyTwelve",
    descKey: "home.penaltyTwelveDesc",
    to: "/games/penalty-twelve",
    tone: "home-green",
    art: "⚽",
  },
  {
    key: "fishBlast",
    labelKey: "nav.fishBlast",
    descKey: "home.fishBlastDesc",
    to: "/games/fishing-blast",
    tone: "home-blue",
    art: "🎣",
  },
];

const moreGames = [
  {
    key: "wordKart",
    labelKey: "nav.wordKart",
    descKey: "home.wordKartDesc",
    to: "/games/word-kart",
    tone: "home-orange",
    art: "🏎️",
  },
  {
    key: "battleJet",
    labelKey: "nav.battleJet",
    descKey: "home.battleJetDesc",
    to: "/games/battle-jet",
    tone: "home-sky",
    art: "✈️",
  },
];

const STARTER_QUIZ_WORD_TARGET = 2;
const STARTER_PHOTO_PATH = "/words/new?tab=photo&scan=camera";
const STARTER_MANUAL_PATH = "/words/new?tab=manual";
const STARTER_QUIZ_PATH = "/review/quiz";

function getRouteOrSignupRedirect(role, targetPath) {
  if (canRoute(role, targetPath)) {
    return targetPath;
  }

  return `/auth?mode=signup&redirect=${encodeURIComponent(targetPath)}`;
}

function getPrimaryCta({ wordCount, dueCount, mistakeCount }) {
  if (dueCount > 0) {
    return {
      key: "reviewDue",
      labelKey: "home.ctaReviewDue",
      to: "/review/flashcards",
      count: dueCount,
    };
  }

  if (mistakeCount > 0) {
    return {
      key: "reviewMistakes",
      labelKey: "home.ctaReviewMistakes",
      to: "/mistakes",
      count: mistakeCount,
    };
  }

  if (wordCount === 0) {
    return {
      key: "addFirst",
      labelKey: "home.ctaAddFirst",
      to: "/words/new?tab=photo",
    };
  }

  return {
    key: "keepLearning",
    labelKey: "home.ctaKeepLearning",
    to: "/review/flashcards",
  };
}

function HomePage() {
  const { locale, t } = useLocale();
  const location = useLocation();
  const { isAuthLoading, isWordsLoading, user, words } = useWordsContext();
  const {
    activeGroup,
    isGroupScopeActive,
    isUsingCustomWords,
    scopedWords,
    isLoadingScope,
  } = useActiveGroupWordScope(words, user);
  const isHomeLoading =
    isAuthLoading ||
    isWordsLoading ||
    (hasSupabaseConfig && Boolean(user) && isLoadingScope);
  const learningWords = isGroupScopeActive ? scopedWords : words;
  const role = getRoleFromUser(user);
  const dueWords = getDueWords(learningWords);
  const mistakeWords = learningWords.filter((word) => word.mistake.isMistake);
  const wordCount = learningWords.length;
  const dueCount = dueWords.length;
  const mistakeCount = mistakeWords.length;
  const isEmpty = wordCount === 0;
  const showSyncPrompt = hasSupabaseConfig && !isAuthLoading && !user;
  const { lastActivity, streak, todayReviewed, dailyTasks } = useMemo(
    () => getLearningSnapshot(learningWords),
    [learningWords, location.key],
  );
  const showContinue = Boolean(lastActivity?.path) && !isEmpty;
  const starterWordsReady = Math.min(wordCount, STARTER_QUIZ_WORD_TARGET);
  const starterWordsRemaining = Math.max(STARTER_QUIZ_WORD_TARGET - wordCount, 0);
  const canStartStarterQuiz = wordCount >= STARTER_QUIZ_WORD_TARGET;
  const showStarterOnboarding =
    !isHomeLoading && (wordCount < STARTER_QUIZ_WORD_TARGET || !lastActivity);
  const starterPrimaryPath = canStartStarterQuiz ? STARTER_QUIZ_PATH : STARTER_PHOTO_PATH;
  const starterPrimaryTo = getRouteOrSignupRedirect(role, starterPrimaryPath);
  const starterManualTo = getRouteOrSignupRedirect(role, STARTER_MANUAL_PATH);
  const showStarterAuthHint = !canRoute(role, starterPrimaryPath);
  const showDailyTasks = !isHomeLoading && wordCount > 0 && !showStarterOnboarding;
  const photoFlagshipTo = getRouteOrSignupRedirect(role, STARTER_PHOTO_PATH);
  const showPhotoFlagship =
    !isHomeLoading && !showStarterOnboarding && canRoute(role, STARTER_PHOTO_PATH);
  const activeGroupLabel = getActiveGroupLabel(activeGroup, locale);

  const dailyTaskLabelKeys = {
    reviewWords: "home.dailyTaskReviewWords",
    playGame: "home.dailyTaskPlayGame",
    clearMistakes: "home.dailyTaskClearMistakes",
  };

  const dailyTaskDescKeys = {
    reviewWords: "home.dailyTaskReviewWordsDesc",
    playGame: "home.dailyTaskPlayGameDesc",
    clearMistakes: "home.dailyTaskClearMistakesDesc",
  };

  const values = {
    words: wordCount,
    due: dueCount,
    mistakes: mistakeCount,
  };

  const primaryCta = getPrimaryCta({
    wordCount,
    dueCount,
    mistakeCount,
  });
  const canAccessPrimaryCta = canRoute(role, primaryCta.to);
  const visibleQuickActions = quickActionLinks.filter((action) =>
    canRoute(role, action.to),
  );

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-top">
          <div className="home-mascot-wrap">
            <LexiMascot className="home-mascot-image" size="xl" title={t("brand.mascotAlt")} />
          </div>
          <div className="home-brand">
            <h1>⭐ {t("home.eyebrow")}</h1>
            <div className="home-brand-title">{t("brand.displayName")}</div>
            <div className="home-brand-sub">{t("brand.tagline")}</div>
            {!isHomeLoading ? (
              isUsingCustomWords ? (
                <p className="home-active-group home-active-group-static">
                  {t("wordGroupsScope.customWordsLabel")}
                </p>
              ) : activeGroupLabel ? (
                <Link className="home-active-group" to="/settings">
                  {t("wordGroupsScope.activeGroupLabel", { group: activeGroupLabel })}
                </Link>
              ) : null
            ) : null}
            {!isHomeLoading ? (
              <>
                <WordScopeModeSwitch className="home-scope-switch" compact />
                {!isEmpty && dueCount > 0 ? (
                  <p className="home-brand-due">
                    <span className="review-word-translation">
                      {t("home.heroDue", { count: dueCount })}
                    </span>
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {!isHomeLoading ? (
          <div className="home-stats">
            <div className="home-card">
              <div className="home-stat-title">{t("home.todayReviewedLabel")}</div>
              <div className="home-stat-row">
                <span className="home-stat-value">{todayReviewed}</span>
                <span aria-hidden="true" className="home-stat-emoji">
                  📒
                </span>
              </div>
            </div>
            <div className="home-card">
              <div className="home-stat-title">{t("home.streakLabel")}</div>
              <div className="home-stat-row">
                <span className="home-stat-value">{streak}</span>
                <span aria-hidden="true" className="home-stat-emoji">
                  🔥
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <div className="home-section">
        {isHomeLoading ? (
          <p aria-busy="true" className="home-loading-banner">
            {t("home.loading")}
          </p>
        ) : null}

        {!isHomeLoading && canAccessPrimaryCta ? (
          <Link className="home-cta" to={primaryCta.to}>
            ✨{" "}
            {primaryCta.count != null
              ? t(primaryCta.labelKey, { count: primaryCta.count })
              : t(primaryCta.labelKey)}
          </Link>
        ) : null}

        {showStarterOnboarding ? (
          <section className="home-starter" aria-labelledby="home-starter-title">
            <div className="home-starter-copy">
              <p className="home-starter-badge">{t("home.starterBadge")}</p>
              <h2 id="home-starter-title">{t("home.starterTitle")}</h2>
              <p>
                {canStartStarterQuiz
                  ? t("home.starterReadyDescription")
                  : t("home.starterDescription", { count: starterWordsRemaining })}
              </p>
            </div>

            <div className="home-starter-progress">
              <span>{t("home.starterProgress", {
                count: starterWordsReady,
                target: STARTER_QUIZ_WORD_TARGET,
              })}</span>
            </div>

            <ol className="home-starter-steps">
              <li className={wordCount > 0 ? "home-starter-step-done" : ""}>
                <span className="home-starter-step-number">1</span>
                <div>
                  <h3>{t("home.starterStepPhotoTitle")}</h3>
                  <p>{t("home.starterStepPhotoDesc")}</p>
                </div>
              </li>
              <li className={wordCount > 0 ? "home-starter-step-done" : ""}>
                <span className="home-starter-step-number">2</span>
                <div>
                  <h3>{t("home.starterStepCardsTitle")}</h3>
                  <p>{t("home.starterStepCardsDesc")}</p>
                </div>
              </li>
              <li className={canStartStarterQuiz ? "home-starter-step-ready" : ""}>
                <span className="home-starter-step-number">3</span>
                <div>
                  <h3>{t("home.starterStepQuizTitle")}</h3>
                  <p>{t("home.starterStepQuizDesc")}</p>
                </div>
              </li>
            </ol>

            <div className="home-starter-actions">
              <Link
                className="home-starter-primary"
                to={starterPrimaryTo}
              >
                {canStartStarterQuiz ? t("home.starterQuizCta") : t("home.starterPhotoCta")}
              </Link>
              {!canStartStarterQuiz ? (
                <Link className="home-starter-secondary" to={starterManualTo}>
                  {t("home.starterManualCta")}
                </Link>
              ) : null}
            </div>
            {showStarterAuthHint ? (
              <p className="home-starter-auth-hint">{t("home.starterAuthHint")}</p>
            ) : null}
          </section>
        ) : null}

        {showPhotoFlagship ? (
          <section className="home-flagship" aria-labelledby="home-flagship-title">
            <div className="home-flagship-copy">
              <p className="home-flagship-badge">{t("home.flagshipBadge")}</p>
              <h2 id="home-flagship-title">{t("home.flagshipTitle")}</h2>
              <p>{t("home.flagshipDescription")}</p>
            </div>

            <ol className="home-flagship-steps" aria-label={t("home.flagshipTitle")}>
              <li>
                <span aria-hidden="true">1</span>
                {t("home.flagshipStepExtract")}
              </li>
              <li>
                <span aria-hidden="true">2</span>
                {t("home.flagshipStepComplete")}
              </li>
              <li>
                <span aria-hidden="true">3</span>
                {t("home.flagshipStepPreview")}
              </li>
            </ol>

            <Link className="home-flagship-cta" to={photoFlagshipTo}>
              <span aria-hidden="true" className="home-flagship-cta-icon">
                📷
              </span>
              {t("home.flagshipCta")}
            </Link>
          </section>
        ) : null}

        {showDailyTasks ? (
          <section className="home-daily" aria-labelledby="home-daily-title">
            <div className="home-daily-header">
              <div>
                <p className="home-daily-badge">{t("home.dailyTasksBadge")}</p>
                <h2 id="home-daily-title">{t("home.dailyTasksTitle")}</h2>
              </div>
              <p className="home-daily-summary">
                {t("home.dailyTasksSummary", {
                  completed: dailyTasks.completedCount,
                  total: dailyTasks.totalCount,
                })}
              </p>
            </div>

            {dailyTasks.allDone ? (
              <p className="home-daily-complete">{t("home.dailyTasksAllDone")}</p>
            ) : null}

            <ul className="home-daily-list">
              {dailyTasks.tasks.map((task) => {
                const taskTo = getRouteOrSignupRedirect(role, task.to);

                return (
                  <li className={task.done ? "home-daily-item home-daily-item-done" : "home-daily-item"} key={task.id}>
                    <Link className="home-daily-link" to={taskTo}>
                      <span aria-hidden="true" className="home-daily-icon">
                        {task.done ? "✓" : task.emoji}
                      </span>
                      <div className="home-daily-copy">
                        <h3>
                          {t(dailyTaskLabelKeys[task.id], { target: task.target })}
                        </h3>
                        <p>{t(dailyTaskDescKeys[task.id])}</p>
                        <div className="home-daily-progress">
                          <div
                            className="home-daily-progress-bar"
                            style={{
                              width: `${Math.round((task.current / task.target) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="home-daily-count">
                          {t("home.dailyTaskProgress", {
                            current: task.current,
                            target: task.target,
                          })}
                        </span>
                      </div>
                      <span aria-hidden="true" className="home-daily-go">
                        ›
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {!isHomeLoading && dueCount > 0 && mistakeCount > 0 ? (
          <Link className="home-mini-pill" to="/mistakes">
            {t("home.secondaryMistakesPill", { count: mistakeCount })}
          </Link>
        ) : null}

        {!isHomeLoading && showContinue ? (
          <Link className="home-continue" to={lastActivity.path}>
            <div className="home-continue-left">
              <div aria-hidden="true" className="home-iconbox">
                {lastActivity.icon}
              </div>
              <div>
                <div className="home-continue-t1">{t("home.continueTitle")}</div>
                <div className="home-continue-t2">
                  {t("home.continueActivity", { name: t(lastActivity.labelKey) })}
                </div>
              </div>
            </div>
            <span aria-hidden="true" className="home-arrow">
              ›
            </span>
          </Link>
        ) : null}

        {!isHomeLoading && showSyncPrompt ? (
          <div className="home-sync-banner">
            <p>{t("home.syncPrompt")}</p>
            <Link className="home-sync-action" to="/auth?mode=login&redirect=/">
              {t("home.syncAction")}
            </Link>
          </div>
        ) : null}

        {!isHomeLoading && isEmpty ? (
          <p className="home-empty-banner">{t("home.emptyGuidance")}</p>
        ) : null}

        {!isHomeLoading ? (
        <div className="home-three">
          {statCards.map((card) => (
            <Link className={`home-small home-${card.tone}`} key={card.key} to={card.to}>
              <div className="home-small-label">{t(`home.${card.shortKey}`)}</div>
              <div className="home-small-num">{values[card.valueKey]}</div>
              <div className="home-small-desc">{t(`home.${card.descKey}`)}</div>
            </Link>
          ))}
        </div>
        ) : null}

        {!isHomeLoading ? (
        <>
        <h2 className="home-section-title">{t("home.quickActionsTitle")}</h2>
        <div className="home-quick-grid">
          {visibleQuickActions.map((action) => (
            <Link
              className={[
                "home-quick",
                action.bg,
                action.featured ? "home-quick-featured" : "",
                action.single ? "home-quick-single" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={action.key}
              to={action.to}
            >
              <div className="home-quick-left">
                <span aria-hidden="true" className={`home-q-icon ${action.iconClass}`}>
                  {action.emoji}
                </span>
                <div>
                  <div className="home-quick-tt">{t(action.labelKey)}</div>
                  <div className="home-quick-dd">{t(action.descKey)}</div>
                </div>
              </div>
              <span aria-hidden="true" className="home-quick-go">
                ›
              </span>
            </Link>
          ))}
        </div>

        <section className={isEmpty ? "home-games-muted" : undefined}>
          <h2 className="home-section-title">{t("home.featuredGamesTitle")}</h2>
          {isEmpty ? <p className="home-games-hint">{t("home.emptyGamesHint")}</p> : null}
          <div className="home-game-list">
            {featuredGames.map((game) => (
              <Link className={`home-game ${game.tone}`} key={game.key} to={game.to}>
                <div className="home-g-left">
                  <div aria-hidden="true" className="home-g-thumb">
                    {game.art}
                  </div>
                  <div>
                    <div className="home-g-name">{t(game.labelKey)}</div>
                    <div className="home-g-sub">{t(game.descKey)}</div>
                  </div>
                </div>
                <span aria-hidden="true" className="home-play">
                  ▶
                </span>
              </Link>
            ))}
          </div>

          <h2 className="home-section-title">{t("home.moreGamesTitle")}</h2>
          <div className="home-more-grid">
            {moreGames.map((game) => (
              <Link className={`home-more ${game.tone}`} key={game.key} to={game.to}>
                <div className="home-more-header">
                  <span
                    aria-hidden="true"
                    className="home-more-art home-more-art-lg"
                  >
                    {game.art}
                  </span>
                  <span aria-hidden="true" className="home-more-play">
                    ▶
                  </span>
                </div>
                <div className="home-more-name">{t(game.labelKey)}</div>
                <p className="home-more-desc">{t(game.descKey)}</p>
              </Link>
            ))}
          </div>
        </section>
        </>
        ) : null}
      </div>
    </div>
  );
}

export default HomePage;
