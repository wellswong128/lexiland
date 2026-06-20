import { Link } from "react-router-dom";
import { useLocale } from "../locale/LocaleContext.jsx";
import { getActiveGroupLabel } from "./getActiveGroupLabel.js";

function WordGroupScopeEmptyState({
  compact = false,
  scopeReason = "",
  activeGroup = null,
}) {
  const { locale, t } = useLocale();
  const groupLabel = getActiveGroupLabel(activeGroup, locale);

  let description = t("wordGroupsScope.emptyDescription");
  if (scopeReason === "no-active-group") {
    description = t("wordGroupsScope.emptyNoActive");
  } else if (scopeReason === "active-group-empty") {
    description = t("wordGroupsScope.emptyNoMappings", { group: groupLabel });
  } else if (scopeReason === "no-matches") {
    description = t("wordGroupsScope.emptyNoMatches", { group: groupLabel });
  }

  return (
    <div
      className={[
        "rounded-2xl border border-dashed border-blue-200 bg-blue-50/70 text-center",
        compact ? "p-5" : "p-8",
      ].join(" ")}
    >
      <h2 className="text-xl font-bold text-blue-950">{t("wordGroupsScope.emptyTitle")}</h2>
      {groupLabel ? (
        <p className="mt-2 text-sm font-semibold text-blue-800">{groupLabel}</p>
      ) : null}
      <p className="mx-auto mt-2 max-w-xl text-slate-600">{description}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link
          className="rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
          to="/settings"
        >
          {t("wordGroupsScope.openSettings")}
        </Link>
        <Link
          className="rounded-full bg-blue-100 px-5 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-200"
          to="/words/new"
        >
          {t("wordGroupsScope.addWord")}
        </Link>
      </div>
    </div>
  );
}

export default WordGroupScopeEmptyState;
