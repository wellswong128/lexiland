import { useEffect, useMemo, useState } from "react";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { useWordsContext } from "../features/words/WordsContext.jsx";
import { getApiAuthHeaders } from "../lib/apiAuth.js";
import { can, getRoleFromUser, PERMISSIONS } from "../lib/authorization.js";

function formatDateTime(value, dateLocale) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString(dateLocale);
}

function renderTipsSummary(memoryTipsByLocale) {
  const localeEntries = Object.entries(memoryTipsByLocale ?? {});
  if (localeEntries.length === 0) {
    return "No tips";
  }

  return localeEntries
    .map(([locale, payload]) => {
      const count = Array.isArray(payload?.tips) ? payload.tips.length : 0;
      return `${locale}: ${count}`;
    })
    .join(" · ");
}

function AdminWordbaseLibraryPage() {
  const { t, dateLocale } = useLocale();
  const { isAuthLoading, user } = useWordsContext();
  const role = getRoleFromUser(user);
  const canManageWordbase = can(role, PERMISSIONS.SETTINGS_MANAGE_USERS);
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [updatingImageId, setUpdatingImageId] = useState("");

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.term.localeCompare(b.term)),
    [rows],
  );

  async function loadRows({ nextSearch = search, nextPage = page, silent = false } = {}) {
    if (!canManageWordbase) {
      setIsLoading(false);
      return;
    }

    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      setError("");
      const authHeaders = await getApiAuthHeaders();
      const query = new URLSearchParams({
        pageSize: "20",
        page: String(nextPage),
      });
      if (nextSearch.trim()) {
        query.set("search", nextSearch.trim());
      }

      const response = await fetch(`/api/admin-wordbase-library?${query.toString()}`, {
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || t("adminWordbaseLibrary.loadError"));
      }

      setRows(payload.rows ?? []);
      setMeta(
        payload.meta ?? {
          page: nextPage,
          pageSize: 20,
          total: payload.rows?.length ?? 0,
          totalPages: 1,
        },
      );
      setPage(payload.meta?.page ?? nextPage);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    void loadRows();
  }, [canManageWordbase, isAuthLoading]);

  async function regenerateImage(row) {
    try {
      setUpdatingImageId(row.id);
      setError("");
      setNotice("");
      const authHeaders = await getApiAuthHeaders();
      const response = await fetch("/api/admin-wordbase-library", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ wordbaseId: row.id }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || t("adminWordbaseLibrary.imageUpdateError"));
      }

      setRows((current) =>
        current.map((item) => (item.id === row.id ? payload.row : item)),
      );
      setNotice(t("adminWordbaseLibrary.imageUpdateSuccess", { term: row.term }));
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setUpdatingImageId("");
    }
  }

  if (isAuthLoading || isLoading) {
    return (
      <section className="w-full max-w-6xl rounded-3xl border border-blue-200/70 bg-white/90 p-8 text-center shadow-2xl shadow-blue-950/10">
        <p className="text-sm font-medium text-slate-600">{t("adminWordbaseLibrary.loading")}</p>
      </section>
    );
  }

  if (!canManageWordbase) {
    return (
      <section className="w-full max-w-6xl rounded-3xl border border-red-200 bg-red-50 p-8 shadow-2xl shadow-red-900/10">
        <h1 className="text-2xl font-bold text-red-800">
          {t("adminWordbaseLibrary.forbiddenTitle")}
        </h1>
        <p className="mt-3 text-sm text-red-700">
          {t("adminWordbaseLibrary.forbiddenDescription")}
        </p>
      </section>
    );
  }

  return (
    <section className="w-full max-w-6xl rounded-3xl border border-blue-200/70 bg-white/90 p-6 shadow-2xl shadow-blue-950/10 sm:p-10">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
        {t("adminWordbaseLibrary.eyebrow")}
      </p>
      <h1 className="text-4xl font-bold text-blue-950 sm:text-5xl">
        {t("adminWordbaseLibrary.title")}
      </h1>
      <p className="mt-3 text-slate-600">{t("adminWordbaseLibrary.description")}</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 sm:max-w-sm"
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder={t("adminWordbaseLibrary.searchPlaceholder")}
          value={search}
        />
        <button
          className="rounded-full bg-blue-700 px-5 py-2 text-sm font-bold text-white transition hover:bg-blue-800 disabled:bg-slate-300"
          disabled={isRefreshing}
          onClick={() => void loadRows({ nextSearch: search, nextPage: page, silent: true })}
          type="button"
        >
          {isRefreshing ? t("adminWordbaseLibrary.refreshing") : t("adminWordbaseLibrary.refresh")}
        </button>
      </div>

      {notice ? (
        <p className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <p className="mt-6 text-sm text-slate-500">
        {t("adminWordbaseLibrary.pageInfo", {
          page: meta.page,
          totalPages: meta.totalPages,
          count: sortedRows.length,
          total: meta.total,
        })}
      </p>

      {sortedRows.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-700">
          {t("adminWordbaseLibrary.empty")}
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        {sortedRows.map((row) => (
          <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" key={row.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{row.term}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {t("adminWordbaseLibrary.contributor")}:{" "}
                  {row.contributorEmail || row.contributorId || "-"}
                </p>
                <p className="text-xs text-slate-500">
                  {t("adminWordbaseLibrary.updatedAt")}: {formatDateTime(row.updatedAt, dateLocale)}
                </p>
              </div>
              <button
                className="rounded-full bg-blue-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-800 disabled:bg-slate-300"
                disabled={updatingImageId === row.id}
                onClick={() => void regenerateImage(row)}
                type="button"
              >
                {updatingImageId === row.id
                  ? t("adminWordbaseLibrary.imageUpdating")
                  : t("adminWordbaseLibrary.imageUpdate")}
              </button>
            </div>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-slate-700">{t("adminWordbaseLibrary.definition")}</dt>
                <dd className="mt-1 text-slate-600">{row.definition || "-"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-700">{t("adminWordbaseLibrary.translation")}</dt>
                <dd className="mt-1 text-slate-600">{row.translation || "-"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-700">{t("adminWordbaseLibrary.example")}</dt>
                <dd className="mt-1 text-slate-600">{row.example || "-"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-700">
                  {t("adminWordbaseLibrary.exampleTranslation")}
                </dt>
                <dd className="mt-1 text-slate-600">{row.exampleTranslation || "-"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-semibold text-slate-700">{t("adminWordbaseLibrary.memoryTips")}</dt>
                <dd className="mt-1 text-slate-600">
                  {renderTipsSummary(row.memoryTipsByLocale)}
                </dd>
              </div>
            </dl>

            <div className="mt-4">
              <p className="text-sm font-semibold text-slate-700">{t("adminWordbaseLibrary.memoryImage")}</p>
              {row.memoryImage?.imageUrl ? (
                <img
                  alt={`${row.term} memory`}
                  className="mt-2 h-44 w-full rounded-xl border border-slate-200 object-cover sm:h-56"
                  src={row.memoryImage.imageUrl}
                />
              ) : (
                <p className="mt-2 text-sm text-slate-500">{t("adminWordbaseLibrary.noMemoryImage")}</p>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-50 disabled:border-slate-200 disabled:text-slate-400"
          disabled={meta.page <= 1 || isRefreshing}
          onClick={() =>
            void loadRows({
              nextSearch: search,
              nextPage: Math.max(1, meta.page - 1),
              silent: true,
            })
          }
          type="button"
        >
          {t("adminWordbaseLibrary.previousPage")}
        </button>
        <button
          className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-50 disabled:border-slate-200 disabled:text-slate-400"
          disabled={meta.page >= meta.totalPages || isRefreshing}
          onClick={() =>
            void loadRows({
              nextSearch: search,
              nextPage: Math.min(meta.totalPages, meta.page + 1),
              silent: true,
            })
          }
          type="button"
        >
          {t("adminWordbaseLibrary.nextPage")}
        </button>
      </div>
    </section>
  );
}

export default AdminWordbaseLibraryPage;
