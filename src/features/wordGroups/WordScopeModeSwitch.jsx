import { useLocale } from "../locale/LocaleContext.jsx";
import { useWordsContext } from "../words/WordsContext.jsx";
import { getActiveGroupLabel } from "./getActiveGroupLabel.js";
import { useActiveGroupWordScope } from "./useActiveGroupWordScope.js";

function WordScopeModeSwitch({ className = "", compact = false }) {
  const { locale, t } = useLocale();
  const { user, words } = useWordsContext();
  const {
    activeGroup,
    isGroupScopeActive,
    isScoped,
    isUsingCustomWords,
    switchToCustomWords,
    switchToGroupWords,
  } = useActiveGroupWordScope(words, user);

  if (!isScoped || !activeGroup) {
    return null;
  }

  const groupLabel = getActiveGroupLabel(activeGroup, locale);
  const buttonClassName = [
    compact ? "word-scope-switch word-scope-switch-compact" : "word-scope-switch",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (isGroupScopeActive) {
    return (
      <button className={buttonClassName} onClick={switchToCustomWords} type="button">
        {t("wordGroupsScope.useCustomWords")}
      </button>
    );
  }

  if (isUsingCustomWords) {
    return (
      <button className={buttonClassName} onClick={switchToGroupWords} type="button">
        {t("wordGroupsScope.useGroupWords", { group: groupLabel })}
      </button>
    );
  }

  return null;
}

export default WordScopeModeSwitch;
