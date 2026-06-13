import { useLocale } from "../features/locale/LocaleContext.jsx";

function GameMistakeSummary({ className = "", terms }) {
  const { t } = useLocale();

  if (!terms?.length) {
    return null;
  }

  return (
    <p
      className={[
        "rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold leading-6 text-violet-900",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {t("games.mistakesAdded", { count: terms.length, words: terms.join(", ") })}
    </p>
  );
}

export default GameMistakeSummary;
