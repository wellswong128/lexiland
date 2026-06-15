import { useLocale } from "../features/locale/LocaleContext.jsx";

function GameWordBankStatus({
  className = "",
  isPriorityLimited = false,
  priorityCount = 0,
  totalPriorityCount = 0,
  usingFallback = false,
}) {
  const { t } = useLocale();

  return (
    <span className={className}>
      {usingFallback ? t("games.usingDemoWords") : t("games.usingSavedWords")}
      {!usingFallback && totalPriorityCount > 0
        ? ` ${t("games.priorityWordsHint", { count: totalPriorityCount })}`
        : null}
      {!usingFallback && isPriorityLimited ? ` ${t("flashcards.reviewFirstTenOnly")}` : null}
    </span>
  );
}

export default GameWordBankStatus;
