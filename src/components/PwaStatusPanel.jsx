import { Link } from "react-router-dom";
import { useState } from "react";
import { useLocale } from "../features/locale/LocaleContext.jsx";
import { usePwaInstall } from "../hooks/usePwaInstall.js";
import { usePwaRuntimeStatus } from "../hooks/usePwaRuntimeStatus.js";
import { applyServiceWorkerUpdate } from "../lib/pwaRuntimeState.js";

function StatusRow({ label, value, tone = "default" }) {
  return (
    <div className={`pwa-status-row pwa-status-row-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PwaStatusPanel({ showInstallActions = true }) {
  const { t } = useLocale();
  const { canInstall, isInstalled, promptInstall } = usePwaInstall();
  const [isUpdating, setIsUpdating] = useState(false);
  const {
    currentVersion,
    isOnline,
    latestVersion,
    needsRefresh,
    offlineReady,
    platform,
    serviceWorkerState,
    serviceWorkerSupported,
  } = usePwaRuntimeStatus();

  const platformLabel = t(`pwa.platform.${platform}`);
  const serviceWorkerLabel = serviceWorkerSupported
    ? t(`pwa.serviceWorker.${serviceWorkerState}`)
    : t("pwa.serviceWorker.unsupported");
  const refreshHint = latestVersion
    ? t("pwa.refreshHintWithVersion", { version: latestVersion })
    : t("pwa.refreshHint");

  async function handleUpdate() {
    if (isUpdating) {
      return;
    }

    setIsUpdating(true);

    try {
      await applyServiceWorkerUpdate();
    } catch {
      setIsUpdating(false);
    }
  }

  return (
    <section aria-labelledby="pwa-status-title" className="pwa-status-panel">
      <h2 className="pwa-status-title" id="pwa-status-title">
        {t("pwa.statusTitle")}
      </h2>
      <p className="pwa-status-description">{t("pwa.statusDescription")}</p>

      <div className="pwa-status-grid">
        <StatusRow label={t("pwa.statusPlatform")} value={platformLabel} />
        <StatusRow
          label={t("pwa.statusInstalled")}
          tone={isInstalled ? "success" : "default"}
          value={isInstalled ? t("pwa.yes") : t("pwa.no")}
        />
        <StatusRow
          label={t("pwa.statusOnline")}
          tone={isOnline ? "success" : "warning"}
          value={isOnline ? t("pwa.yes") : t("pwa.no")}
        />
        <StatusRow
          label={t("pwa.statusServiceWorker")}
          tone={
            serviceWorkerState === "active" || serviceWorkerState === "native"
              ? "success"
              : serviceWorkerState === "unsupported" || serviceWorkerState === "error"
                ? "warning"
                : "default"
          }
          value={
            serviceWorkerSupported ? serviceWorkerLabel : t("pwa.serviceWorker.unsupported")
          }
        />
        <StatusRow
          label={t("pwa.statusOfflineReady")}
          tone={offlineReady ? "success" : "default"}
          value={offlineReady ? t("pwa.yes") : t("pwa.no")}
        />
        {currentVersion && !currentVersion.startsWith("dev") ? (
          <StatusRow label={t("pwa.statusCurrentVersion")} value={currentVersion} />
        ) : null}
      </div>

      {needsRefresh ? (
        <>
          <p className="pwa-status-note pwa-status-note-info">{refreshHint}</p>
          <button
            className="pwa-status-update-action"
            disabled={isUpdating}
            onClick={() => {
              void handleUpdate();
            }}
            type="button"
          >
            {isUpdating ? t("pwa.updateButtonLoading") : t("pwa.updateButton")}
          </button>
        </>
      ) : null}

      {!isOnline ? (
        <p className="pwa-status-note pwa-status-note-warning">{t("pwa.offlineNote")}</p>
      ) : null}

      {showInstallActions && canInstall ? (
        <button
          className="install-page-button"
          onClick={() => {
            void promptInstall();
          }}
          type="button"
        >
          {t("install.installButton")}
        </button>
      ) : null}

      {showInstallActions && !isInstalled ? (
        <Link className="install-page-home-link" to="/install">
          {t("pwa.openInstallGuide")}
        </Link>
      ) : null}
    </section>
  );
}

export default PwaStatusPanel;
