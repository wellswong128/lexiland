import { useEffect, useState } from "react";
import { useLocale } from "../locale/LocaleContext.jsx";
import { fetchReminderSettings, updateReminderSettings } from "./reminderApi.js";

function detectTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Hong_Kong";
  } catch {
    return "Asia/Hong_Kong";
  }
}

export default function EveningReminderSettings({ user }) {
  const { locale, t } = useLocale();
  const [enabled, setEnabled] = useState(false);
  const [timezone, setTimezone] = useState(detectTimezone());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("success");

  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return undefined;
    }

    let cancelled = false;

    async function loadSettings() {
      setIsLoading(true);

      try {
        const payload = await fetchReminderSettings();
        if (cancelled) {
          return;
        }

        setEnabled(Boolean(payload.settings?.evening_reminder_enabled));
        setTimezone(payload.settings?.timezone || detectTimezone());
      } catch (error) {
        if (!cancelled) {
          setNoticeType("error");
          setNotice(error.message || t("settings.reminderLoadError"));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [t, user?.id]);

  async function handleToggle(nextEnabled) {
    setIsSaving(true);
    setNotice("");

    try {
      const payload = await updateReminderSettings({
        eveningReminderEnabled: nextEnabled,
        timezone,
        locale,
      });

      setEnabled(Boolean(payload.settings?.evening_reminder_enabled));
      setTimezone(payload.settings?.timezone || detectTimezone());
      setNoticeType("success");
      setNotice(
        nextEnabled ? t("settings.reminderEnabledNotice") : t("settings.reminderDisabledNotice"),
      );
    } catch (error) {
      setNoticeType("error");
      setNotice(error.message || t("settings.reminderSaveError"));
    } finally {
      setIsSaving(false);
    }
  }

  if (!user) {
    return null;
  }

  return (
    <div className="mb-5 rounded-2xl bg-blue-50 p-5">
      <h2 className="text-lg font-bold text-blue-950">{t("settings.reminderTitle")}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{t("settings.reminderDescription")}</p>
      <p className="mt-2 text-xs text-slate-500">
        {t("settings.reminderTimezone", { timezone })}
      </p>

      {notice ? (
        <p
          className={[
            "mt-4 rounded-2xl border px-4 py-3 text-sm font-medium",
            noticeType === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700",
          ].join(" ")}
        >
          {notice}
        </p>
      ) : null}

      <label className="mt-4 flex items-start gap-3 rounded-2xl border border-blue-200 bg-white p-4">
        <input
          checked={enabled}
          className="mt-1 h-4 w-4"
          disabled={isLoading || isSaving}
          onChange={(event) => handleToggle(event.target.checked)}
          type="checkbox"
        />
        <span className="text-sm leading-6 text-slate-700">
          <span className="block font-bold text-blue-950">{t("settings.reminderToggleLabel")}</span>
          <span className="mt-1 block text-slate-600">{t("settings.reminderToggleHint")}</span>
        </span>
      </label>
    </div>
  );
}
