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
    single: true,
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
            {!isEmpty && dueCount > 0 ? (
              <p className="home-brand-due">
                <span className="review-word-translation">
                  {t("home.heroDue", { count: dueCount })}
                </span>
              </p>
            ) : null}
          </div>
        </div>

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
      </section>

      <div className="home-section">

        <Link className="home-cta" to={primaryCta.to}>
          ✨{" "}
          {primaryCta.count != null
            ? t(primaryCta.labelKey, { count: primaryCta.count })
            : t(primaryCta.labelKey)}
        </Link>

        {dueCount > 0 && mistakeCount > 0 ? (
          <Link className="home-mini-pill" to="/mistakes">
            {t("home.secondaryMistakesPill", { count: mistakeCount })}
          </Link>
        ) : null}

        {showContinue ? (
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

        {showSyncPrompt ? (
          <div className="home-sync-banner">
            <p>{t("home.syncPrompt")}</p>
            <Link className="home-sync-action" to="/auth?mode=login&redirect=/">
              {t("home.syncAction")}
            </Link>
          </div>
        ) : null}

        {isEmpty ? <p className="home-empty-banner">{t("home.emptyGuidance")}</p> : null}

        <div className="home-three">
          {statCards.map((card) => (
            <Link className={`home-small home-${card.tone}`} key={card.key} to={card.to}>
              <div className="home-small-label">{t(`home.${card.shortKey}`)}</div>
              <div className="home-small-num">{values[card.valueKey]}</div>
              <div className="home-small-desc">{t(`home.${card.descKey}`)}</div>
            </Link>
          ))}
        </div>

        <h2 className="home-section-title">{t("home.quickActionsTitle")}</h2>
        <div className="home-quick-grid">
          {quickActionLinks.map((action) => (
            <Link
              className={[
                "home-quick",
                action.bg,
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
      </div>
    </div>
  );
}

export default HomePage;
