import { useEffect, useState } from "react";
import { useLocale } from "../locale/LocaleContext.jsx";
import {
  cancelLocalNotificationTest,
  canUseLocalNotifications,
  getLocalNotificationPermissionStatus,
  scheduleLocalNotificationTest,
} from "../../lib/localNotificationTest.js";

function formatScheduledTime(date, locale) {
  try {
    return new Intl.DateTimeFormat(locale === "zh" ? "zh-HK" : "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  } catch {
    return date.toLocaleTimeString();
  }
}

export default function LocalNotificationTestPanel() {
  const { locale, t } = useLocale();
  const [permission, setPermission] = useState("unsupported");
  const [isLoadingPermission, setIsLoadingPermission] = useState(true);
  const [isScheduling, setIsScheduling] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("success");

  useEffect(() => {
    if (!canUseLocalNotifications()) {
      setPermission("unsupported");
      setIsLoadingPermission(false);
      return undefined;
    }

    let cancelled = false;

    async function loadPermission() {
      setIsLoadingPermission(true);

      try {
        const status = await getLocalNotificationPermissionStatus();
        if (!cancelled) {
          setPermission(status);
        }
      } catch {
        if (!cancelled) {
          setPermission("unknown");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPermission(false);
        }
      }
    }

    loadPermission();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!canUseLocalNotifications()) {
    return null;
  }

  async function handleScheduleTest() {
    setIsScheduling(true);
    setNotice("");

    try {
      const fireAt = await scheduleLocalNotificationTest({
        title: t("settings.localNotificationTestTitle"),
        body: t("settings.localNotificationTestBody"),
      });

      const status = await getLocalNotificationPermissionStatus();
      setPermission(status);
      setNoticeType("success");
      setNotice(
        t("settings.localNotificationTestScheduled", {
          time: formatScheduledTime(fireAt, locale),
        }),
      );
    } catch (error) {
      setNoticeType("error");
      setNotice(error.message || t("settings.localNotificationTestError"));
    } finally {
      setIsScheduling(false);
    }
  }

  async function handleCancelTest() {
    setNotice("");

    try {
      await cancelLocalNotificationTest();
      setNoticeType("success");
      setNotice(t("settings.localNotificationTestCancelled"));
    } catch (error) {
      setNoticeType("error");
      setNotice(error.message || t("settings.localNotificationTestError"));
    }
  }

  const permissionLabel =
    permission === "granted"
      ? t("settings.localNotificationPermissionGranted")
      : permission === "denied"
        ? t("settings.localNotificationPermissionDenied")
        : t("settings.localNotificationPermissionPrompt");

  return (
    <div className="mb-5 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
        {t("settings.localNotificationTestBadge")}
      </p>
      <h2 className="mt-2 text-lg font-bold text-blue-950">
        {t("settings.localNotificationTestSectionTitle")}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {t("settings.localNotificationTestDescription")}
      </p>
      <p className="mt-3 text-sm font-medium text-slate-700">
        {t("settings.localNotificationPermissionLabel")}:{" "}
        {isLoadingPermission ? "..." : permissionLabel}
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

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          className="rounded-full bg-amber-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-amber-700 disabled:bg-slate-300"
          disabled={isScheduling}
          onClick={handleScheduleTest}
          type="button"
        >
          {isScheduling
            ? t("settings.localNotificationTestScheduling")
            : t("settings.localNotificationTestButton")}
        </button>
        <button
          className="rounded-full border border-amber-300 bg-white px-5 py-3 text-sm font-bold text-amber-800 transition hover:bg-amber-100"
          onClick={handleCancelTest}
          type="button"
        >
          {t("settings.localNotificationTestCancelButton")}
        </button>
      </div>
    </div>
  );
}
