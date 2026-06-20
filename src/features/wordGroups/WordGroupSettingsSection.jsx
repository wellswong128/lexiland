import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLocale } from "../locale/LocaleContext.jsx";
import {
  fetchUserGroupPicks,
  fetchWordGroups,
  saveUserGroupPicks,
  setUserActiveGroup,
} from "./wordGroupsApi.js";
import { notifyActiveGroupChanged } from "./wordGroupScopeEvents.js";

const GRADE_OPTIONS = ["P1", "P2", "P3", "P4", "P5", "P6", "S1", "S2", "S3", "S4", "S5", "S6"];

function compareGrades(a, b) {
  return GRADE_OPTIONS.indexOf(a.grade) - GRADE_OPTIONS.indexOf(b.grade);
}

function getGroupLabel(group, locale) {
  if (locale === "en") {
    return group.displayNameEn || group.groupCode;
  }

  return group.displayNameZhHant || group.displayNameEn || group.groupCode;
}

function WordGroupSettingsSection({ user, hasSupabaseConfig }) {
  const { locale, t } = useLocale();
  const [availableGroups, setAvailableGroups] = useState([]);
  const [pickedGroupCodes, setPickedGroupCodes] = useState([]);
  const [activeGroupCode, setActiveGroupCode] = useState("");
  const [browseGrade, setBrowseGrade] = useState("P1");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingPicks, setIsSavingPicks] = useState(false);
  const [isSwitchingActive, setIsSwitchingActive] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const pickedGroups = useMemo(() => {
    const codeSet = new Set(pickedGroupCodes);
    return availableGroups.filter((group) => codeSet.has(group.groupCode)).sort(compareGrades);
  }, [availableGroups, pickedGroupCodes]);

  const browseGroups = useMemo(
    () =>
      availableGroups
        .filter((group) => group.grade === browseGrade)
        .sort((a, b) => a.subject.localeCompare(b.subject)),
    [availableGroups, browseGrade],
  );

  async function loadGroupState() {
    if (!user || !hasSupabaseConfig) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const [groupsPayload, picksPayload] = await Promise.all([
        fetchWordGroups(),
        fetchUserGroupPicks(),
      ]);

      const groups = groupsPayload.groups ?? [];
      const nextPickedCodes = (picksPayload.groups ?? []).map((group) => group.groupCode);
      const nextActiveCode = picksPayload.activeGroupCode || "";

      setAvailableGroups(groups);
      setPickedGroupCodes(nextPickedCodes);
      setActiveGroupCode(nextActiveCode);

      if (nextPickedCodes.length > 0) {
        const firstPicked = groups.find((group) => group.groupCode === nextPickedCodes[0]);
        if (firstPicked?.grade) {
          setBrowseGrade(firstPicked.grade);
        }
      }
    } catch (loadError) {
      setError(loadError.message || t("settings.wordGroups.loadError"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadGroupState();
  }, [user, hasSupabaseConfig]);

  function togglePick(groupCode) {
    setPickedGroupCodes((current) => {
      if (current.includes(groupCode)) {
        return current.filter((code) => code !== groupCode);
      }

      return [...current, groupCode];
    });
  }

  async function handleSavePicks() {
    try {
      setIsSavingPicks(true);
      setError("");
      setNotice("");

      const payload = await saveUserGroupPicks(pickedGroupCodes);
      const nextPickedCodes = (payload.groups ?? []).map((group) => group.groupCode);
      const nextActiveCode = payload.activeGroupCode || "";

      setPickedGroupCodes(nextPickedCodes);
      setActiveGroupCode(nextActiveCode);
      setNotice(t("settings.wordGroups.saveSuccess"));
      notifyActiveGroupChanged();
    } catch (saveError) {
      setError(saveError.message || t("settings.wordGroups.saveError"));
    } finally {
      setIsSavingPicks(false);
    }
  }

  async function handleActiveGroupChange(nextGroupCode) {
    if (!nextGroupCode || nextGroupCode === activeGroupCode) {
      return;
    }

    try {
      setIsSwitchingActive(true);
      setError("");
      setNotice("");

      const payload = await setUserActiveGroup(nextGroupCode);
      setActiveGroupCode(payload.activeGroupCode || nextGroupCode);
      setNotice(t("settings.wordGroups.activeUpdated"));
      notifyActiveGroupChanged();
    } catch (switchError) {
      setError(switchError.message || t("settings.wordGroups.activeError"));
    } finally {
      setIsSwitchingActive(false);
    }
  }

  if (!hasSupabaseConfig) {
    return null;
  }

  return (
    <div className="mb-5 rounded-2xl bg-blue-50 p-5">
      <h2 className="text-lg font-bold text-blue-950">{t("settings.wordGroups.title")}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {t("settings.wordGroups.description")}
      </p>

      {!user ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-6 text-slate-600">
            {t("settings.wordGroups.signInRequired")}
          </p>
          <Link
            className="inline-flex justify-center rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
            to="/auth?mode=login&redirect=/settings"
          >
            {t("auth.loginLink")}
          </Link>
        </div>
      ) : isLoading ? (
        <p className="mt-4 text-sm text-slate-600">{t("settings.wordGroups.loading")}</p>
      ) : (
        <>
          {error ? (
            <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}

          {notice ? (
            <p className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              {notice}
            </p>
          ) : null}

          {availableGroups.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">{t("settings.wordGroups.emptyCatalog")}</p>
          ) : (
            <>
              <div className="mt-5 rounded-2xl border border-blue-200 bg-white p-4">
                <label className="block text-sm font-bold text-blue-950" htmlFor="browse-grade">
                  {t("settings.wordGroups.browseGrade")}
                </label>
                <select
                  className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-slate-700"
                  id="browse-grade"
                  onChange={(event) => setBrowseGrade(event.target.value)}
                  value={browseGrade}
                >
                  {GRADE_OPTIONS.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>

                <div className="mt-4 space-y-2">
                  {browseGroups.length === 0 ? (
                    <p className="text-sm text-slate-600">
                      {t("settings.wordGroups.noGroupsForGrade")}
                    </p>
                  ) : (
                    browseGroups.map((group) => {
                      const checked = pickedGroupCodes.includes(group.groupCode);
                      return (
                        <label
                          className="flex cursor-pointer items-start gap-3 rounded-xl border border-blue-100 px-3 py-2"
                          key={group.groupCode}
                        >
                          <input
                            checked={checked}
                            className="mt-1"
                            onChange={() => togglePick(group.groupCode)}
                            type="checkbox"
                          />
                          <span className="text-sm text-slate-700">
                            {getGroupLabel(group, locale)}
                            <span className="mt-1 block text-xs text-slate-500">
                              {group.groupCode}
                            </span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>

                <button
                  className="mt-4 rounded-full bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:bg-slate-300"
                  disabled={isSavingPicks}
                  onClick={handleSavePicks}
                  type="button"
                >
                  {isSavingPicks
                    ? t("settings.wordGroups.savingPicks")
                    : t("settings.wordGroups.savePicks")}
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-blue-200 bg-white p-4">
                <h3 className="text-base font-bold text-blue-950">
                  {t("settings.wordGroups.pickedTitle")}
                </h3>
                {pickedGroups.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">
                    {t("settings.wordGroups.noPicksYet")}
                  </p>
                ) : (
                  <>
                    <ul className="mt-3 space-y-2">
                      {pickedGroups.map((group) => (
                        <li
                          className="rounded-xl border border-blue-100 px-3 py-2 text-sm text-slate-700"
                          key={group.groupCode}
                        >
                          {getGroupLabel(group, locale)}
                        </li>
                      ))}
                    </ul>

                    <label className="mt-4 block text-sm font-bold text-blue-950" htmlFor="active-group">
                      {t("settings.wordGroups.activeGroup")}
                    </label>
                    <select
                      className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-slate-700"
                      disabled={isSwitchingActive}
                      id="active-group"
                      onChange={(event) => {
                        void handleActiveGroupChange(event.target.value);
                      }}
                      value={activeGroupCode}
                    >
                      <option value="">{t("settings.wordGroups.selectActive")}</option>
                      {pickedGroups.map((group) => (
                        <option key={group.groupCode} value={group.groupCode}>
                          {getGroupLabel(group, locale)}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default WordGroupSettingsSection;
