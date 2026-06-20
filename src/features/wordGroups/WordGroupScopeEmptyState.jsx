import { Link } from "react-router-dom";
import { useLocale } from "../locale/LocaleContext.jsx";

function WordGroupScopeEmptyState({ compact = false }) {
  const { t } = useLocale();

  return (
    <div
      className={[
        "rounded-2xl border border-dashed border-blue-200 bg-blue-50/70 text-center",
        compact ? "p-5" : "p-8",
      ].join(" ")}
    >
      <h2 className="text-xl font-bold text-blue-950">{t("wordGroupsScope.emptyTitle")}</h2>
      <p className="mx-auto mt-2 max-w-xl text-slate-600">
        {t("wordGroupsScope.emptyDescription")}
      </p>
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
