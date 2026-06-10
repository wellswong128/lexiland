import { Link } from "react-router-dom";
import GameHomeButton from "../components/GameHomeButton.jsx";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { getDueWords } from "../features/review/reviewHelpers.js";
import { useWordsContext } from "../features/words/WordsContext.jsx";

const statCards = [
  {
    key: "savedWords",
    valueKey: "words",
    tone: "saved",
    icon: "📚",
  },
  {
    key: "dueReviews",
    valueKey: "due",
    tone: "due",
    icon: "⏰",
  },
  {
    key: "mistakes",
    valueKey: "mistakes",
    tone: "mistakes",
    icon: "🎯",
  },
];

const actionLinks = [
  {
    key: "addWord",
    labelKey: "common.addWord",
    to: "/words/new",
    variant: "primary",
  },
  {
    key: "flashcards",
    labelKey: "home.flashcards",
    to: "/review/flashcards",
    variant: "secondary",
  },
  {
    key: "quiz",
    labelKey: "home.startQuiz",
    to: "/review/quiz",
    variant: "neutral",
  },
];

const gameTiles = [
  {
    key: "ninja",
    labelKey: "home.ninja",
    to: "/games/spelling-ninja",
    tone: "ninja",
    icon: "🥷",
  },
  {
    key: "fishBlast",
    labelKey: "home.fishBlast",
    to: "/games/fishing-blast",
    tone: "fish",
    icon: "🐟",
  },
  {
    key: "wordKart",
    labelKey: "home.wordKart",
    to: "/games/word-kart",
    tone: "kart",
    icon: "🏎️",
  },
  {
    key: "grammar",
    labelKey: "home.grammar",
    to: "/games/grammar-arena",
    tone: "grammar",
    icon: "⚔️",
  },
  {
    key: "battleJet",
    labelKey: "home.battleJet",
    to: "/games/battle-jet",
    tone: "jet",
    icon: "✈️",
  },
  {
    key: "penaltyTwelve",
    labelKey: "home.penaltyTwelve",
    to: "/games/penalty-twelve",
    tone: "penalty",
    icon: "⚽",
  },
];

function HomePage() {
  const { t } = useLocale();
  const { words } = useWordsContext();
  const dueWords = getDueWords(words);
  const mistakeWords = words.filter((word) => word.mistake.isMistake);

  const values = {
    words: words.length,
    due: dueWords.length,
    mistakes: mistakeWords.length,
  };

  return (
    <section className="home-page relative w-full max-w-5xl overflow-hidden rounded-[2rem] border border-blue-200/60 bg-white/95 p-4 shadow-2xl shadow-blue-950/10 backdrop-blur sm:p-8">
      <div aria-hidden="true" className="home-page-glow home-page-glow-left" />
      <div aria-hidden="true" className="home-page-glow home-page-glow-right" />

      <div className="relative z-50 mb-2">
        <GameHomeButton variant="light" />
      </div>

      <div className="home-stats relative grid grid-cols-3 gap-2 sm:gap-4">
        {statCards.map((card) => (
          <div className={`home-stat-card home-stat-${card.tone}`} key={card.key}>
            <span aria-hidden="true" className="home-stat-icon">
              {card.icon}
            </span>
            <p className="home-stat-value">{values[card.valueKey]}</p>
            <p className="home-stat-label">{t(`home.${card.key}`)}</p>
          </div>
        ))}
      </div>

      <div className="home-actions relative mt-5 sm:mt-8">
        <p className="home-section-label">{t("home.quickActions")}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center sm:gap-3">
          {actionLinks.map((action) => (
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

      <div className="home-games relative mt-5 sm:mt-8">
        <p className="home-section-label">{t("home.games")}</p>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-3">
          {gameTiles.map((game) => (
            <Link
              className={`home-game-tile home-game-${game.tone}`}
              key={game.key}
              to={game.to}
            >
              <span aria-hidden="true" className="home-game-icon">
                {game.icon}
              </span>
              <span className="home-game-name">{t(game.labelKey)}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HomePage;
