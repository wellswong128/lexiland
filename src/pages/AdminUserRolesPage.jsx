import { useEffect, useMemo, useState } from "react";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { useWordsContext } from "../features/words/WordsContext.jsx";
import { can, getRoleFromUser, PERMISSIONS } from "../lib/authorization.js";
import { getApiAuthHeaders } from "../lib/apiAuth.js";
import { resolveApiUrl } from "../lib/apiBase.js";

const ROLE_OPTIONS = ["owner", "admin", "teacher", "student", "parent"];

function formatDateTime(value, dateLocale) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString(dateLocale);
}

function AdminUserRolesPage() {
  const { dateLocale, t } = useLocale();
  const { isAuthLoading, user } = useWordsContext();
  const [users, setUsers] = useState([]);
  const [pendingRoles, setPendingRoles] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savingUserId, setSavingUserId] = useState("");
  const role = getRoleFromUser(user);
  const canManageUsers = can(role, PERMISSIONS.SETTINGS_MANAGE_USERS);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.email.localeCompare(b.email)),
    [users],
  );

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!canManageUsers) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    async function loadUsers() {
      try {
        setIsLoading(true);
        setError("");
        const authHeaders = await getApiAuthHeaders();
        const response = await fetch(resolveApiUrl("/api/admin-users"), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || t("adminRoles.loadError"));
        }

        if (!mounted) {
          return;
        }

        const items = payload.users ?? [];
        setUsers(items);
        setPendingRoles(
          Object.fromEntries(items.map((item) => [item.id, item.role ?? "student"])),
        );
      } catch (loadError) {
        if (mounted) {
          setError(loadError.message);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadUsers();

    return () => {
      mounted = false;
    };
  }, [canManageUsers, isAuthLoading, t]);

  async function saveRole(targetUser) {
    const nextRole = pendingRoles[targetUser.id];
    if (!nextRole || nextRole === targetUser.role) {
      return;
    }

    try {
      setSavingUserId(targetUser.id);
      setError("");
      setNotice("");
      const authHeaders = await getApiAuthHeaders();
      const response = await fetch(resolveApiUrl("/api/admin-users"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          userId: targetUser.id,
          role: nextRole,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || t("adminRoles.saveError"));
      }

      setUsers((current) =>
        current.map((item) =>
          item.id === targetUser.id ? { ...item, role: payload.user.role } : item,
        ),
      );
      setNotice(
        t("adminRoles.saveSuccess", {
          email: payload.user.email || targetUser.email,
          role: payload.user.role,
        }),
      );
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingUserId("");
    }
  }

  if (isAuthLoading || isLoading) {
    return (
      <section className="w-full max-w-5xl rounded-3xl border border-blue-200/70 bg-white/90 p-8 text-center shadow-2xl shadow-blue-950/10">
        <p className="text-sm font-medium text-slate-600">{t("adminRoles.loading")}</p>
      </section>
    );
  }

  if (!canManageUsers) {
    return (
      <section className="w-full max-w-5xl rounded-3xl border border-red-200 bg-red-50 p-8 shadow-2xl shadow-red-900/10">
        <h1 className="text-2xl font-bold text-red-800">{t("adminRoles.forbiddenTitle")}</h1>
        <p className="mt-3 text-sm text-red-700">{t("adminRoles.forbiddenDescription")}</p>
      </section>
    );
  }

  return (
    <section className="w-full max-w-5xl rounded-3xl border border-blue-200/70 bg-white/90 p-6 shadow-2xl shadow-blue-950/10 sm:p-10">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
        {t("adminRoles.eyebrow")}
      </p>
      <h1 className="text-4xl font-bold text-blue-950 sm:text-5xl">
        {t("adminRoles.title")}
      </h1>
      <p className="mt-3 text-slate-600">{t("adminRoles.description")}</p>

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

      <div className="mt-6 space-y-3">
        {sortedUsers.map((item) => (
          <div
            className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
            key={item.id}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-slate-800">{item.email || item.id}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {t("adminRoles.createdAt")}: {formatDateTime(item.createdAt, dateLocale)} ·{" "}
                  {t("adminRoles.lastSignInAt")}: {formatDateTime(item.lastSignInAt, dateLocale)}
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                  onChange={(event) =>
                    setPendingRoles((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                  value={pendingRoles[item.id] ?? item.role ?? "student"}
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <button
                  className="rounded-full bg-blue-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-800 disabled:bg-slate-300"
                  disabled={
                    savingUserId === item.id ||
                    (pendingRoles[item.id] ?? item.role) === item.role
                  }
                  onClick={() => void saveRole(item)}
                  type="button"
                >
                  {savingUserId === item.id
                    ? t("adminRoles.saving")
                    : t("adminRoles.saveRole")}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default AdminUserRolesPage;
