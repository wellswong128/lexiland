import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLocale } from "../locale/LocaleContext.jsx";
import { getActiveGroupLabel } from "./getActiveGroupLabel.js";
import { getFriendlyNetworkError } from "../../lib/networkErrors.js";
import { saveCachedActiveGroupScope } from "./activeGroupScopeCache.js";
import {
  fetchUserActiveGroupWords,
  fetchUserGroupPicks,
  fetchWordGroups,
  saveUserGroupPicks,
  setUserActiveGroup,
} from "./wordGroupsApi.js";
import { notifyActiveGroupChanged } from "./wordGroupScopeEvents.js";

const GRADE_OPTIONS = ["P1", "P2", "P3", "P4", "P5", "P6", "S1", "S2", "S3", "S4", "S5", "S6"];

function getGroupLabel(group, locale) {
  return getActiveGroupLabel(group, locale);
}

function WordGroupSettingsSection({ user, hasSupabaseConfig }) {
  const { locale, t } = useLocale();
  const [availableGroups, setAvailableGroups] = useState([]);
  const [pickedGroupCodes, setPickedGroupCodes] = useState([]);
  const [activeGroupCode, setActiveGroupCode] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitchingActive, setIsSwitchingActive] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const activeGroup = useMemo(
    () => availableGroups.find((group) => group.groupCode === activeGroupCode) ?? null,
    [activeGroupCode, availableGroups],
  );

  const gradeGroups = useMemo(
    () =>
      availableGroups
        .filter((group) => group.grade === selectedGrade)
        .sort((a, b) => a.subject.localeCompare(b.subject)),
    [availableGroups, selectedGrade],
  );

  const gradesWithGroups = useMemo(() => {
    const gradeSet = new Set(availableGroups.map((group) => group.grade));
    return GRADE_OPTIONS.filter((grade) => gradeSet.has(grade));
  }, [availableGroups]);

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
      const nextActiveGroup = groups.find((group) => group.groupCode === nextActiveCode);
      const gradeSet = new Set(groups.map((group) => group.grade));
      const firstGradeWithGroups = GRADE_OPTIONS.find((grade) => gradeSet.has(grade)) || "P1";

      setAvailableGroups(groups);
      setPickedGroupCodes(nextPickedCodes);
      setActiveGroupCode(nextActiveCode);
      setSelectedGrade(nextActiveGroup?.grade || firstGradeWithGroups);
    } catch (loadError) {
      setError(
        getFriendlyNetworkError(
          loadError.message,
          t,
          "settings.wordGroups.offlineError",
        ) || t("settings.wordGroups.loadError"),
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadGroupState();
  }, [user, hasSupabaseConfig]);

  useEffect(() => {
    if (!selectedGrade && gradesWithGroups.length > 0) {
      setSelectedGrade(activeGroup?.grade || gradesWithGroups[0]);
    }
  }, [activeGroup?.grade, gradesWithGroups, selectedGrade]);

  async function handleSelectGroup(group) {
    if (!group?.groupCode || group.groupCode === activeGroupCode || isSwitchingActive) {
      return;
    }

    try {
      setIsSwitchingActive(true);
      setError("");
      setNotice("");

      let nextPickedCodes = pickedGroupCodes;
      if (!pickedGroupCodes.includes(group.groupCode)) {
        nextPickedCodes = [...pickedGroupCodes, group.groupCode];
        const pickPayload = await saveUserGroupPicks(nextPickedCodes);
        nextPickedCodes = (pickPayload.groups ?? []).map((item) => item.groupCode);
        setPickedGroupCodes(nextPickedCodes);
      }

      await setUserActiveGroup(group.groupCode);
      const scopePayload = await fetchUserActiveGroupWords({
        forceRefresh: true,
        includeWords: true,
      });
      const activeGroup = scopePayload.activeGroup ?? {
        groupCode: group.groupCode,
        grade: group.grade,
        subject: group.subject,
        displayNameEn: group.displayNameEn ?? "",
        displayNameZhHant: group.displayNameZhHant ?? "",
      };
      const mappedTerms = Array.isArray(scopePayload.mappedTerms) ? scopePayload.mappedTerms : [];

      saveCachedActiveGroupScope(user.id, { activeGroup, mappedTerms });
      setActiveGroupCode(activeGroup.groupCode || group.groupCode);
      setSelectedGrade(group.grade);
      setNotice(t("settings.wordGroups.activeUpdated"));
      notifyActiveGroupChanged({ activeGroup, mappedTerms, scopePayload });
    } catch (switchError) {
      setError(
        getFriendlyNetworkError(
          switchError.message,
          t,
          "settings.wordGroups.offlineActiveError",
        ) || t("settings.wordGroups.activeError"),
      );
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
            <div className="mt-5 space-y-5 rounded-2xl border border-blue-200 bg-white p-4">
              {activeGroup ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/80 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
                    {t("settings.wordGroups.currentActive")}
                  </p>
                  <p className="mt-1 text-base font-bold text-blue-950">
                    {getGroupLabel(activeGroup, locale)}
                  </p>
                </div>
              ) : null}

              <div>
                <p className="text-sm font-bold text-blue-950">
                  {t("settings.wordGroups.browseGrade")}
                </p>
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {GRADE_OPTIONS.map((grade) => {
                    const hasGroups = gradesWithGroups.includes(grade);
                    const isSelected = selectedGrade === grade;
                    const isActiveGrade = activeGroup?.grade === grade;

                    return (
                      <button
                        className={[
                          "rounded-2xl border px-2 py-3 text-sm font-bold transition",
                          !hasGroups
                            ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300"
                            : isSelected
                              ? "border-blue-700 bg-blue-700 text-white shadow-md shadow-blue-900/10"
                              : "border-blue-100 bg-white text-blue-900 hover:border-blue-300 hover:bg-blue-50",
                        ].join(" ")}
                        disabled={!hasGroups || isSwitchingActive}
                        key={grade}
                        onClick={() => setSelectedGrade(grade)}
                        type="button"
                      >
                        {grade}
                        {isActiveGrade ? (
                          <span className="mt-1 block text-[10px] font-semibold opacity-80">
                            ●
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-sm font-bold text-blue-950">
                  {t("settings.wordGroups.chooseSubject")}
                  {selectedGrade ? ` · ${selectedGrade}` : ""}
                </p>

                {gradeGroups.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">
                    {t("settings.wordGroups.noGroupsForGrade")}
                  </p>
                ) : (
                  <div className="mt-3 grid gap-2">
                    {gradeGroups.map((group) => {
                      const isActive = group.groupCode === activeGroupCode;

                      return (
                        <button
                          className={[
                            "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition",
                            isActive
                              ? "border-green-500 bg-green-50 text-green-950"
                              : "border-blue-100 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50",
                            isSwitchingActive ? "opacity-70" : "",
                          ].join(" ")}
                          disabled={isSwitchingActive}
                          key={group.groupCode}
                          onClick={() => {
                            void handleSelectGroup(group);
                          }}
                          type="button"
                        >
                          <span>
                            <span className="block text-sm font-bold">
                              {getGroupLabel(group, locale)}
                            </span>
                            <span className="mt-1 block text-xs text-slate-500">
                              {group.groupCode}
                            </span>
                          </span>
                          {isActive ? (
                            <span className="rounded-full bg-green-600 px-2.5 py-1 text-xs font-bold text-white">
                              ✓
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default WordGroupSettingsSection;
