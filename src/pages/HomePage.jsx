import { Link } from "react-router-dom";
import LexiMascot from "../components/LexiMascot.jsx";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { getDueWords } from "../features/review/reviewHelpers.js";
import { useWordsContext } from "../features/words/WordsContext.jsx";
import { getLearningSnapshot } from "../lib/learningActivity.js";
import { hasSupabaseConfig } from "../lib/supabaseClient.js";

const statCards = [
  {
    key: "savedWords",
    shortKey: "savedWordsShort",
    valueKey: "words",
    tone: "saved",
    to: "/words",
  },
  {
    key: "dueReviews",
    shortKey: "dueReviewsShort",
    valueKey: "due",
    tone: "due",
    to: "/review/flashcards",
  },
  {
    key: "mistakes",
    shortKey: "mistakesShort",
    valueKey: "mistakes",
    tone: "mistakes",
    to: "/mistakes",
  },
];

const quickActionLinks = [
  {
    key: "photo",
    labelKey: "addWord.tabPhoto",
    to: "/words/new?tab=photo",
    variant: "photo",
  },
  {
    key: "addWord",
    labelKey: "common.addWord",
    to: "/words/new",
    variant: "secondary",
  },
  {
    key: "wordList",
    labelKey: "common.wordList",
    to: "/words",
    variant: "secondary",
  },
  {
    key: "flashcards",
    labelKey: "home.flashcards",
    to: "/review/flashcards",
    variant: "neutral",
  },
  {
    key: "quiz",
    labelKey: "home.startQuiz",
    to: "/review/quiz",
    variant: "neutral",
  },
];

const featuredGames = [
  {
    key: "ninja",
    labelKey: "nav.ninjaGame",
    descKey: "home.ninjaDesc",
    to: "/games/spelling-ninja",
    tone: "ninja",
    icon: "🥷",
  },
  {
    key: "penaltyTwelve",
    labelKey: "nav.penaltyTwelve",
    descKey: "home.penaltyTwelveDesc",
    to: "/games/penalty-twelve",
    tone: "penalty",
    icon: "⚽",
  },
  {
    key: "fishBlast",
    labelKey: "nav.fishBlast",
    descKey: "home.fishBlastDesc",
    to: "/games/fishing-blast",
    tone: "fish",
    icon: "🐟",
  },
];

const moreGames = [
  {
    key: "wordKart",
    labelKey: "nav.wordKart",
    descKey: "home.wordKartDesc",
    to: "/games/word-kart",
    tone: "kart",
    icon: "🏎️",
  },
  {
    key: "battleJet",
    labelKey: "nav.battleJet",
    descKey: "home.battleJetDesc",
    to: "/games/battle-jet",
    tone: "jet",
    icon: "✈️",
  },
];

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

function getHeroMessage({ dueCount, mistakeCount, streak, wordCount, t }) {
  if (wordCount === 0) {
    return t("home.description");
  }

  if (dueCount > 0) {
    return t("home.heroDue", { count: dueCount });
  }

  if (mistakeCount > 0) {
    return t("home.heroMistakes", { count: mistakeCount });
  }

  if (streak > 1) {
    return t("home.heroStreak", { count: streak });
  }

  return t("home.description");
}

function HomePage() {
  const { t } = useLocale();
  const { isAuthLoading, user, words } = useWordsContext();
  const dueWords = getDueWords(words);
  const mistakeWords = words.filter((word) => word.mistake.isMistake);
  const wordCount = words.length;
  const dueCount = dueWords.length;
  const mistakeCount = mistakeWords.length;
  const isEmpty = wordCount === 0;
  const showSyncPrompt = hasSupabaseConfig && !isAuthLoading && !user;
  const { lastActivity, streak, todayReviewed } = getLearningSnapshot(words);
  const showProgress = wordCount > 0;
  const showContinue = Boolean(lastActivity?.path) && !isEmpty;

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

  const heroMessage = getHeroMessage({
    dueCount,
    mistakeCount,
    streak,
    wordCount,
    t,
  });

  return (
    <section className="home-page relative w-full max-w-5xl overflow-hidden rounded-[2rem] border border-blue-200/60 bg-white/95 p-4 shadow-2xl shadow-blue-950/10 backdrop-blur sm:p-8">
      <div aria-hidden="true" className="home-page-glow home-page-glow-left" />
      <div aria-hidden="true" className="home-page-glow home-page-glow-right" />

      <div className="home-hero relative text-center">
        <div className="home-mascot-wrap">
          <LexiMascot className="lexi-mascot-home" size="xl" title={t("brand.mascotAlt")} />
        </div>
        <p className="home-eyebrow">{t("home.eyebrow")}</p>
        <h1 className="home-title">{t("brand.name")}</h1>
        <p className="home-description">
          <span className="home-tagline">{t("brand.tagline")}</span>
          {!isEmpty && heroMessage !== t("home.description") ? (
            <>
              <br />
              {heroMessage}
            </>
          ) : null}
        </p>
      </div>

      {showProgress ? (
        <div className="home-progress relative mt-4 grid grid-cols-2 gap-2 sm:mx-auto sm:max-w-md">
          <div className="home-progress-card">
            <p className="home-progress-label">{t("home.todayReviewedLabel")}</p>
            <p className="home-progress-value">{todayReviewed}</p>
          </div>
          <div className="home-progress-card">
            <p className="home-progress-label">{t("home.streakLabel")}</p>
            <p className="home-progress-value">{streak}</p>
          </div>
        </div>
      ) : null}

      <div className="home-primary-cta relative mt-5 sm:mt-6">
        <Link className="home-primary-cta-btn" to={primaryCta.to}>
          {primaryCta.count != null
            ? t(primaryCta.labelKey, { count: primaryCta.count })
            : t(primaryCta.labelKey)}
        </Link>
        {dueCount > 0 && mistakeCount > 0 ? (
          <Link className="home-secondary-cta" to="/mistakes">
            {t("home.secondaryMistakes", { count: mistakeCount })}
          </Link>
        ) : null}
      </div>

      {showContinue ? (
        <Link className="home-continue-card relative mt-4" to={lastActivity.path}>
          <span aria-hidden="true" className="home-continue-icon">
            {lastActivity.icon}
          </span>
          <span className="home-continue-copy">
            <span className="home-continue-label">{t("home.continueTitle")}</span>
            <span className="home-continue-name">
              {t("home.continueActivity", { name: t(lastActivity.labelKey) })}
            </span>
          </span>
        </Link>
      ) : null}

      {showSyncPrompt ? (
        <div className="home-sync-banner relative mt-4 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-slate-600">{t("home.syncPrompt")}</p>
          <Link
            className="home-sync-action inline-flex shrink-0 justify-center rounded-full bg-white px-4 py-2 text-sm font-bold text-blue-700 ring-1 ring-blue-200 transition hover:bg-blue-100"
            to="/auth?mode=login&redirect=/"
          >
            {t("home.syncAction")}
          </Link>
        </div>
      ) : null}

      {isEmpty ? (
        <p className="home-empty-banner relative mt-4 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-center text-sm leading-6 text-amber-900">
          {t("home.emptyGuidance")}
        </p>
      ) : null}

      <div className="home-stats relative mt-5 grid grid-cols-3 gap-2 sm:mt-6 sm:gap-4">
        {statCards.map((card) => (
          <Link
            className={`home-stat-card home-stat-${card.tone}`}
            key={card.key}
            title={t(`home.${card.key}`)}
            to={card.to}
          >
            <p className="home-stat-label">{t(`home.${card.shortKey}`)}</p>
            <p className="home-stat-value">{values[card.valueKey]}</p>
          </Link>
        ))}
      </div>

      <div className="home-actions relative mt-5 sm:mt-8">
        <p className="home-section-label">{t("home.quickActions")}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center sm:gap-3">
          {quickActionLinks.map((action) => (
            <Link
              className={`home-action-btn home-action-${action.variant}`}
              key={action.key}
              to={action.to}
            >
              {t(action.labelKey)}
            </Link>
          ))}
        </div>
      </div>

      <div className={`home-games relative mt-5 sm:mt-8${isEmpty ? " home-games-muted" : ""}`}>
        <p className="home-section-label">{t("home.featuredGames")}</p>
        {isEmpty ? (
          <p className="home-games-hint mt-2 text-center text-sm text-slate-500">
            {t("home.emptyGamesHint")}
          </p>
        ) : null}
        <div className="mt-3 grid gap-2.5 sm:grid-cols-3 sm:gap-3">
          {featuredGames.map((game) => (
            <Link
              className={`home-game-tile home-game-tile-featured home-game-${game.tone}`}
              key={game.key}
              to={game.to}
            >
              <span aria-hidden="true" className="home-game-icon">
                {game.icon}
              </span>
              <span className="home-game-name">{t(game.labelKey)}</span>
              <span className="home-game-desc">{t(game.descKey)}</span>
            </Link>
          ))}
        </div>

        <p className="home-section-label mt-6">{t("home.moreGames")}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 sm:gap-3">
          {moreGames.map((game) => (
            <Link
              className={`home-more-game-tile home-game-${game.tone}`}
              key={game.key}
              to={game.to}
            >
              <span aria-hidden="true" className="home-more-game-icon">
                {game.icon}
              </span>
              <span className="home-more-game-copy">
                <span className="home-more-game-name">{t(game.labelKey)}</span>
                <span className="home-more-game-desc">{t(game.descKey)}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HomePage;
