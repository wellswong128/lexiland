import { useLocale } from "../features/locale/LocaleContext.jsx";

function GameWordBankStatus({ className = "", priorityCount = 0, usingFallback = false }) {
  const { t } = useLocale();

  return (
    <span className={className}>
      {usingFallback ? t("games.usingDemoWords") : t("games.usingSavedWords")}
      {!usingFallback && priorityCount > 0
        ? ` ${t("games.priorityWordsHint", { count: priorityCount })}`
        : null}
    </span>
  );
}

export default GameWordBankStatus;
