import { useEffect, useMemo, useState } from "react";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { useWordsContext } from "../features/words/WordsContext.jsx";
import { getApiAuthHeaders } from "../lib/apiAuth.js";
import { resolveApiUrl } from "../lib/apiBase.js";
import { can, getRoleFromUser, PERMISSIONS } from "../lib/authorization.js";
import { mapWordbaseRow } from "../lib/wordbaseCompleteness.js";
import { hasSupabaseConfig, supabase } from "../lib/supabaseClient.js";

const FIELD_LABEL_KEYS = {
  definition: "adminWordbaseLibrary.definition",
  translation: "adminWordbaseLibrary.translation",
  example: "adminWordbaseLibrary.example",
  exampleTranslation: "adminWordbaseLibrary.exampleTranslation",
  memoryTips: "adminWordbaseLibrary.memoryTips",
  memoryImage: "adminWordbaseLibrary.memoryImage",
};

function formatDateTime(value, dateLocale) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString(dateLocale);
}

function AdminWordbasePage() {
  const { t, dateLocale, locale } = useLocale();
  const { isAuthLoading, user } = useWordsContext();
  const role = getRoleFromUser(user);
  const canManageWordbase = can(role, PERMISSIONS.SETTINGS_MANAGE_USERS);
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refillingId, setRefillingId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.term.localeCompare(b.term)),
    [rows],
  );

  async function loadRowsFromSupabase(nextSearch) {
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase.rpc("get_incomplete_wordbase_rows", {
      p_limit: 120,
      p_search: nextSearch.trim() || null,
    });

    if (error) {
      return { error: error.message };
    }

    return {
      rows: (data ?? []).map((row) => mapWordbaseRow(row, locale)),
    };
  }

  async function loadRowsFromApi(nextSearch) {
    const authHeaders = await getApiAuthHeaders();
    const query = new URLSearchParams({
      limit: "120",
      missingOnly: "1",
      locale,
    });
    if (nextSearch.trim()) {
      query.set("search", nextSearch.trim());
    }

    const response = await fetch(resolveApiUrl(`/api/admin-wordbase?${query.toString()}`), {
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || t("adminWordbase.loadError"));
    }

    return payload;
  }

  async function loadRows({ nextSearch = search, silent = false } = {}) {
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
      let payload = null;

      if (hasSupabaseConfig) {
        payload = await loadRowsFromSupabase(nextSearch);
        if (payload?.error) {
          payload = await loadRowsFromApi(nextSearch);
        }
      } else {
        payload = await loadRowsFromApi(nextSearch);
      }

      setRows(payload?.rows ?? []);
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
  }, [canManageWordbase, isAuthLoading, locale]);

  async function handleDelete(row) {
    const shouldDelete = window.confirm(t("adminWordbase.deleteConfirm", { term: row.term }));
    if (!shouldDelete) {
      return;
    }

    try {
      setDeletingId(row.id);
      setError("");
      setNotice("");
      const authHeaders = await getApiAuthHeaders();
      const response = await fetch(resolveApiUrl("/api/admin-wordbase"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ action: "delete", wordbaseId: row.id, term: row.term }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || t("adminWordbase.deleteError"));
      }

      setRows((current) => current.filter((item) => item.id !== row.id));
      setNotice(t("adminWordbase.deleteSuccess", { term: row.term }));
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setDeletingId("");
    }
  }

  async function handleRefill(row) {
    try {
      setRefillingId(row.id);
      setError("");
      setNotice("");
      const authHeaders = await getApiAuthHeaders();
      const response = await fetch(resolveApiUrl("/api/admin-wordbase"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ wordbaseId: row.id, locale }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || t("adminWordbase.refillError"));
      }

      if (payload.updated) {
        setNotice(t("adminWordbase.refillSuccess", { term: row.term }));
      } else {
        setNotice(t("adminWordbase.noMissingData", { term: row.term }));
      }

      await loadRows({ silent: true });
    } catch (refillError) {
      setError(refillError.message);
    } finally {
      setRefillingId("");
    }
  }

  if (isAuthLoading || isLoading) {
    return (
      <section className="w-full max-w-5xl rounded-3xl border border-blue-200/70 bg-white/90 p-8 text-center shadow-2xl shadow-blue-950/10">
        <p className="text-sm font-medium text-slate-600">{t("adminWordbase.loading")}</p>
      </section>
    );
  }

  if (!canManageWordbase) {
    return (
      <section className="w-full max-w-5xl rounded-3xl border border-red-200 bg-red-50 p-8 shadow-2xl shadow-red-900/10">
        <h1 className="text-2xl font-bold text-red-800">{t("adminWordbase.forbiddenTitle")}</h1>
        <p className="mt-3 text-sm text-red-700">{t("adminWordbase.forbiddenDescription")}</p>
      </section>
    );
  }

  return (
    <section className="w-full max-w-5xl rounded-3xl border border-blue-200/70 bg-white/90 p-6 shadow-2xl shadow-blue-950/10 sm:p-10">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
        {t("adminWordbase.eyebrow")}
      </p>
      <h1 className="text-4xl font-bold text-blue-950 sm:text-5xl">{t("adminWordbase.title")}</h1>
      <p className="mt-3 text-slate-600">{t("adminWordbase.description")}</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 sm:max-w-sm"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("adminWordbase.searchPlaceholder")}
          value={search}
        />
        <button
          className="rounded-full bg-blue-700 px-5 py-2 text-sm font-bold text-white transition hover:bg-blue-800 disabled:bg-slate-300"
          disabled={isRefreshing}
          onClick={() => void loadRows({ nextSearch: search, silent: true })}
          type="button"
        >
          {isRefreshing ? t("adminWordbase.refreshing") : t("adminWordbase.refresh")}
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
        {t("adminWordbase.rowCount", { count: sortedRows.length })}
      </p>

      {sortedRows.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-700">
          {t("adminWordbase.empty")}
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {sortedRows.map((row) => (
          <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" key={row.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-base font-bold text-slate-900">{row.term}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {t("adminWordbase.updatedAt")}: {formatDateTime(row.updatedAt, dateLocale)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-full bg-blue-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-800 disabled:bg-slate-300"
                  disabled={refillingId === row.id || deletingId === row.id || row.missingFields.length === 0}
                  onClick={() => void handleRefill(row)}
                  type="button"
                >
                  {refillingId === row.id ? t("adminWordbase.refilling") : t("adminWordbase.refill")}
                </button>
                <button
                  className="rounded-full bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:bg-slate-100 disabled:text-slate-400"
                  disabled={refillingId === row.id || deletingId === row.id}
                  onClick={() => void handleDelete(row)}
                  type="button"
                >
                  {deletingId === row.id ? t("adminWordbase.deleting") : t("common.delete")}
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {row.missingFields.map((field) => (
                <span
                  className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
                  key={`${row.id}-${field}`}
                >
                  {t(FIELD_LABEL_KEYS[field] ?? field)}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default AdminWordbasePage;
